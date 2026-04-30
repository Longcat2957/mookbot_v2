import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { cloudflare, datadragon, db } from "@mookbot/core";
import { diagnosePerms, userCanEdit } from "../auth/perms.js";
import { broadcast } from "../ws/rooms.js";

const { listRecruitmentParticipants, getRecruitment } = db;

function invalidate(topic: string, originUser?: string): void {
	broadcast(topic, { t: "invalidate", topic, originUser });
}

// Data Dragon 절대 URL 을 nginx 프록시 경로로 변환 (Activity iframe same-origin)
const DD_ORIGIN = "https://ddragon.leagueoflegends.com";
function rewriteDD(url: string): string {
	return url.startsWith(DD_ORIGIN) ? url.replace(DD_ORIGIN, "/dd") : url;
}

function requireSession(req: FastifyRequest, reply: FastifyReply): string | null {
	const sid = req.cookies.sid ? req.unsignCookie(req.cookies.sid) : null;
	if (!sid?.valid) {
		reply.code(401).send({ error: "unauthenticated" });
		return null;
	}
	return sid.value;
}

async function requireEditor(
	req: FastifyRequest,
	reply: FastifyReply,
): Promise<string | null> {
	const sid = requireSession(req, reply);
	if (!sid) return null;
	const ok = await userCanEdit(sid);
	if (!ok) {
		reply.code(403).send({
			error: "쓰기 권한이 없습니다. 운영자(Operator) role 이 필요합니다.",
		});
		return null;
	}
	return sid;
}

function requireInternalKey(req: FastifyRequest, reply: FastifyReply): boolean {
	const expected = process.env.INTERNAL_API_KEY;
	if (!expected) {
		reply.code(503).send({ error: "INTERNAL_API_KEY not configured" });
		return false;
	}
	const got = req.headers["x-internal-key"];
	if (got !== expected) {
		reply.code(401).send({ error: "invalid internal key" });
		return false;
	}
	return true;
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
	// 봇이 D1 직접 쓰면서 api 의 WS 룸에 invalidate 를 트리거하기 위한 내부 엔드포인트.
	// shared secret 인증.
	app.post<{ Body: { topic: string } }>("/internal/notify", async (req, reply) => {
		if (!requireInternalKey(req, reply)) return;
		const { topic } = req.body ?? {};
		if (typeof topic !== "string" || !topic) {
			return reply.code(400).send({ error: "topic required" });
		}
		invalidate(topic);
		return { ok: true };
	});

	app.get("/healthz", async () => ({ ok: true }));

	// OAuth2 token exchange — Activity SDK authorize() 의 code 를 access_token 으로 교환
	// (Discord Embedded App SDK 표준 흐름: authorize → /api/token → authenticate)
	app.post<{ Body: { code: string } }>("/api/token", async (req, reply) => {
		const { code } = req.body ?? {};
		if (!code) return reply.code(400).send({ error: "code required" });

		const clientId = process.env.CLIENT_ID;
		const clientSecret = process.env.DISCORD_CLIENT_SECRET;
		if (!clientId || !clientSecret) {
			return reply.code(500).send({ error: "CLIENT_ID / DISCORD_CLIENT_SECRET unset" });
		}

		const params = new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: "authorization_code",
			code,
			redirect_uri: process.env.OAUTH_REDIRECT_URI ?? "https://bot.mooklol.com",
		});
		const res = await fetch("https://discord.com/api/oauth2/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: params,
		});
		if (!res.ok) {
			const text = await res.text();
			req.log.warn({ status: res.status, text }, "token exchange failed");
			return reply.code(401).send({ error: "token exchange failed" });
		}
		const { access_token } = (await res.json()) as { access_token: string };
		return { access_token };
	});

	// OAuth2 세션 발급 — Activity SDK authenticate() 후 access_token 으로 사용자 검증
	app.post<{ Body: { access_token: string } }>("/api/session", async (req, reply) => {
		const { access_token } = req.body ?? {};
		if (!access_token) return reply.code(400).send({ error: "access_token required" });

		const res = await fetch("https://discord.com/api/users/@me", {
			headers: { Authorization: `Bearer ${access_token}` },
		});
		if (!res.ok) return reply.code(401).send({ error: "invalid token" });
		const user = (await res.json()) as { id: string; username: string };

		reply.setCookie("sid", user.id, {
			path: "/",
			httpOnly: true,
			secure: true,
			sameSite: "none",
			signed: true,
			maxAge: 60 * 60 * 24,
		});
		return { user };
	});

	app.get("/api/me", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;
		const canEdit = await userCanEdit(sid);
		return {
			discordId: sid,
			canEdit,
			operatorRoleConfigured: Boolean(
				process.env.OPERATOR_ROLE_ID || process.env.OPERATOR_ROLE_NAME,
			),
		};
	});

	// 권한 진단 — 본인 권한 상태 확인용 (운영자 디버그 화면에 노출 가능)
	app.get("/api/me/perms", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;
		return diagnosePerms(sid);
	});

	// 엔트리 수정 대기 중인 모집 목록 (status = CLOSED)
	app.get("/api/recruitments", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;

		const rows = await db
			.listBuildableRecruitments()
			.then((rs) => rs.filter((r) => r.status === "CLOSED"));

		return {
			recruitments: rows.map((r) => ({
				id: r.id,
				targetCount: r.target_count,
				status: r.status,
				createdBy: r.created_by,
				createdAt: r.created_at,
			})),
		};
	});

	// 시리즈 생성 — 엔트리 수정에서 [엔트리 제출] 시 호출.
	// 모집의 status 를 CONVERTED 로 전이 + series row + series_participants insert.
	app.post<{
		Body: {
			recruitmentId: number;
			assignments: { userId: string; team: "TEAM_1" | "TEAM_2"; role: string }[];
		};
	}>("/api/series", async (req, reply) => {
		const sid = await requireEditor(req, reply);
		if (!sid) return;

		const { recruitmentId, assignments } = req.body ?? {};
		if (!recruitmentId || !Array.isArray(assignments)) {
			return reply.code(400).send({ error: "recruitmentId / assignments required" });
		}

		const rec = await getRecruitment(recruitmentId);
		if (!rec) return reply.code(404).send({ error: "recruitment not found" });
		if (rec.status === "CONVERTED") {
			return reply.code(409).send({ error: "이미 시리즈로 변환된 모집입니다." });
		}
		if (rec.status === "CANCELLED") {
			return reply.code(409).send({ error: "취소된 모집입니다." });
		}

		try {
			const series = await db.createSeries({
				seasonId: rec.season_id,
				createdBy: sid,
				participants: assignments.map((a) => ({
					userId: a.userId,
					team: a.team,
					role: a.role as
						| "TOP"
						| "JUNGLE"
						| "MID"
						| "BOTTOM"
						| "SUPPORT",
				})),
			});
			await db.setRecruitmentStatus(recruitmentId, "CONVERTED", series.id);
			invalidate("dashboard");
			invalidate(`recruitment:${recruitmentId}`);
			invalidate(`series:${series.id}`);
			return { seriesId: series.id };
		} catch (err) {
			req.log.error({ err, recruitmentId }, "createSeries failed");
			const msg = err instanceof Error ? err.message : String(err);
			return reply.code(400).send({ error: msg });
		}
	});

	// 종료된 시리즈 목록 (status=COMPLETED) — 지난 내전 기록.
	app.get<{ Querystring: { limit?: string } }>(
		"/api/series/completed",
		async (req, reply) => {
			const sid = requireSession(req, reply);
			if (!sid) return;

			const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
			const rows = await cloudflare.query<{
				id: number;
				season_id: number;
				status: string;
				winning_team: string | null;
				started_at: number;
				ended_at: number | null;
			}>(
				`SELECT id, season_id, status, winning_team, started_at, ended_at
				 FROM series
				 WHERE status = 'COMPLETED'
				 ORDER BY ended_at DESC
				 LIMIT ?`,
				[limit],
			);
			if (rows.length === 0) return { series: [] };

			const seriesIds = rows.map((s) => s.id);
			const partsAll = await Promise.all(
				seriesIds.map((id) => db.getSeriesParticipants(id)),
			);
			const allUserIds = [...new Set(partsAll.flat().map((p) => p.user_id))];
			const users = await db.listUsers(allUserIds);
			const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));

			const winsAll = await Promise.all(
				rows.map((s) => db.countSeriesWins(s.id)),
			);

			return {
				series: rows.map((s, i) => ({
					id: s.id,
					seasonId: s.season_id,
					status: s.status,
					winningTeam: s.winning_team,
					startedAt: s.started_at,
					endedAt: s.ended_at,
					wins: winsAll[i] ?? { team1: 0, team2: 0 },
					participants: (partsAll[i] ?? []).map((p) => ({
						userId: p.user_id,
						displayName: nameById.get(p.user_id) ?? p.user_id,
						team: p.team,
						role: p.role,
					})),
				})),
			};
		},
	);

	// 진행 중 시리즈 목록 (status=IN_PROGRESS) — Activity 재진입 시 이어서 작업.
	// 카드 미리보기용으로 라인업도 같이 반환.
	app.get("/api/series", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;

		const rows = await db.listAllOpenSeries();
		if (rows.length === 0) return { series: [] };

		// 모든 참가자 한 번에 — 시리즈별로 그룹핑
		const seriesIds = rows.map((s) => s.id);
		const partsAll = await Promise.all(
			seriesIds.map((id) => db.getSeriesParticipants(id)),
		);
		const allUserIds = [
			...new Set(partsAll.flat().map((p) => p.user_id)),
		];
		const users = await db.listUsers(allUserIds);
		const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));

		return {
			series: rows.map((s, i) => ({
				id: s.id,
				seasonId: s.season_id,
				status: s.status,
				startedAt: s.started_at,
				participants: (partsAll[i] ?? []).map((p) => ({
					userId: p.user_id,
					displayName: nameById.get(p.user_id) ?? p.user_id,
					team: p.team,
					role: p.role,
				})),
			})),
		};
	});

	// 단일 시리즈 상세 — 참가자 + 픽/밴 draft + 완료 게임
	app.get<{ Params: { id: string } }>("/api/series/:id", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;

		const id = Number(req.params.id);
		if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });

		const s = await db.getSeries(id);
		if (!s) return reply.code(404).send({ error: "not found" });

		const parts = await db.getSeriesParticipants(id);
		const users = await db.listUsers(parts.map((p) => p.user_id));
		const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));
		// PickBan 의 챔프 그리드 "MY MAINS" 표시용 — 참가자 전적/주력 챔프
		const stats = await fetchPlayHistoryFor(parts.map((p) => p.user_id));

		const games = await db.listGamesInSeries(id);
		// 게임별 picks/bans 조회 — picks 는 하드피어리스 검증, bans 는 SeriesResult 화면용
		const [gamePicks, gameBans] = await Promise.all([
			Promise.all(
				games.map(async (g) => ({ gameId: g.id, picks: await db.getGamePicks(g.id) })),
			),
			Promise.all(
				games.map(async (g) => ({ gameId: g.id, bans: await db.getGameBans(g.id) })),
			),
		]);
		const picksByGame = new Map(gamePicks.map((x) => [x.gameId, x.picks]));
		const bansByGame = new Map(gameBans.map((x) => [x.gameId, x.bans]));

		const draftRaw = await db.getKv(`pickban:${id}`);
		let draft: unknown = null;
		if (draftRaw) {
			try {
				draft = JSON.parse(draftRaw);
			} catch {
				draft = null;
			}
		}

		return {
			series: {
				id: s.id,
				seasonId: s.season_id,
				status: s.status,
				startedAt: s.started_at,
				winningTeam: s.winning_team,
			},
			participants: parts.map((p) => ({
				userId: p.user_id,
				displayName: nameById.get(p.user_id) ?? p.user_id,
				team: p.team,
				role: p.role,
				history: stats.get(p.user_id) ?? emptyHistory(),
			})),
			games: games.map((g) => ({
				id: g.id,
				gameNumber: g.game_number,
				winningTeam: g.winning_team,
				team1Side: g.team1_side,
				durationSec: g.duration_sec,
				picks: (picksByGame.get(g.id) ?? []).map((p) => {
					const champ = datadragon.findChampion(p.champion_name);
					return {
						team: p.team,
						role: p.role,
						championName: p.champion_name,
						championId: champ ? Number(champ.key) : null,
					};
				}),
				bans: (bansByGame.get(g.id) ?? []).map((b) => {
					const champ = datadragon.findChampion(b.champion_name);
					return {
						team: b.team,
						position: b.position,
						championName: b.champion_name,
						championId: champ ? Number(champ.key) : null,
					};
				}),
			})),
			pickbanDraft: draft,
		};
	});

	// 게임 결과 기록 — picks/bans/side/winner 모두 포함.
	// db.recordGameAndUpdateMmr (game + game_stats + mmr_changes + user_lane_mmr) +
	// db.setGamePicks / setGameBans. Bo3 종료 조건도 같이 검사.
	app.post<{
		Params: { id: string };
		Body: {
			gameNumber: number;
			team1Side: "BLUE" | "RED";
			winningTeam: "TEAM_1" | "TEAM_2";
			durationMin?: number;
			picks: { TEAM_1: { role: string; championId: number }[]; TEAM_2: { role: string; championId: number }[] };
			bans: { TEAM_1: number[]; TEAM_2: number[] };
		};
	}>("/api/series/:id/games", async (req, reply) => {
		const sid = await requireEditor(req, reply);
		if (!sid) return;

		const id = Number(req.params.id);
		if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });
		const s = await db.getSeries(id);
		if (!s) return reply.code(404).send({ error: "not found" });
		if (s.status !== "IN_PROGRESS") {
			return reply.code(409).send({ error: `series status is ${s.status}` });
		}

		const body = req.body;
		if (!body || ![1, 2, 3].includes(body.gameNumber)) {
			return reply.code(400).send({ error: "gameNumber must be 1/2/3" });
		}
		const gameNumber = body.gameNumber as 1 | 2 | 3;

		// Game N 입력은 Game N-1 이 완료된 후에만 가능
		const games = await db.listGamesInSeries(id);
		const completed = new Set<number>(games.map((g) => g.game_number));
		if (gameNumber > 1 && !completed.has(gameNumber - 1)) {
			return reply
				.code(409)
				.send({ error: `Game ${gameNumber - 1} 결과를 먼저 입력해야 합니다.` });
		}
		if (completed.has(gameNumber)) {
			return reply.code(409).send({ error: `Game ${gameNumber} 은(는) 이미 기록됨` });
		}

		// 참가자 → role/team → userId 매핑
		const parts = await db.getSeriesParticipants(id);
		const userByTeamRole = new Map<string, string>();
		for (const p of parts) userByTeamRole.set(`${p.team}_${p.role}`, p.user_id);

		// picks → PlayerStats[]
		const stats: { userId: string; championId: number }[] = [];
		const picksFlat: { team: "TEAM_1" | "TEAM_2"; role: string; championName: string }[] = [];
		for (const team of ["TEAM_1", "TEAM_2"] as const) {
			for (const pick of body.picks[team]) {
				const userId = userByTeamRole.get(`${team}_${pick.role}`);
				if (!userId) {
					return reply
						.code(400)
						.send({ error: `${team}/${pick.role} 슬롯에 참가자 없음` });
				}
				stats.push({ userId, championId: pick.championId });
				picksFlat.push({
					team,
					role: pick.role,
					championName: datadragon.getChampionName(pick.championId),
				});
			}
		}

		const bansFlat: { team: "TEAM_1" | "TEAM_2"; position: number; championName: string }[] = [];
		for (const team of ["TEAM_1", "TEAM_2"] as const) {
			body.bans[team].forEach((cid, i) => {
				bansFlat.push({
					team,
					position: i + 1,
					championName: datadragon.getChampionName(cid),
				});
			});
		}

		try {
			const result = await db.recordGameAndUpdateMmr({
				seriesId: id,
				gameNumber,
				winningTeam: body.winningTeam,
				team1Side: body.team1Side,
				...(body.durationMin ? { durationSec: body.durationMin * 60 } : {}),
				stats,
			});

			// picks / bans 별도 INSERT (record.ts 가 처리하지 않음)
			await db.setGamePicks(
				result.game.id,
				picksFlat.map((p) => ({
					team: p.team,
					role: p.role as "TOP" | "JUNGLE" | "MID" | "BOTTOM" | "SUPPORT",
					championName: p.championName,
				})),
			);
			await db.setGameBans(result.game.id, bansFlat);

			// Bo3 종료 — 한 팀이 2승 도달 시 자동 COMPLETED
			const wins = await db.countSeriesWins(id);
			let completedSeries = false;
			if (wins.team1 >= 2) {
				await db.completeSeries(id, "TEAM_1");
				completedSeries = true;
			} else if (wins.team2 >= 2) {
				await db.completeSeries(id, "TEAM_2");
				completedSeries = true;
			}

			invalidate(`series:${id}`);
			if (completedSeries) invalidate("dashboard");
			return {
				gameId: result.game.id,
				wins,
				completed: completedSeries,
			};
		} catch (err) {
			req.log.error({ err }, "recordGameAndUpdateMmr failed");
			const msg = err instanceof Error ? err.message : String(err);
			return reply.code(400).send({ error: msg });
		}
	});

	// 직전 게임 되돌리기 — 마지막으로 기록된 game DELETE (cascade)
	app.delete<{ Params: { id: string } }>(
		"/api/series/:id/games/last",
		async (req, reply) => {
			const sid = await requireEditor(req, reply);
			if (!sid) return;

			const id = Number(req.params.id);
			if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });
			const s = await db.getSeries(id);
			if (!s) return reply.code(404).send({ error: "not found" });

			const games = await db.listGamesInSeries(id);
			if (games.length === 0) {
				return reply.code(409).send({ error: "되돌릴 게임이 없습니다." });
			}
			const last = games[games.length - 1]!;

			// game DELETE 시 cascade 로 stats/picks/bans/mmr_changes 정리.
			// user_lane_mmr 차감은 recordGame 에서만 처리하므로 직접 보정 필요.
			const mmrChanges = await cloudflare.query<{
				user_id: string;
				role: string;
				delta: number;
				season_id: number;
			}>(`SELECT user_id, role, delta, season_id FROM mmr_changes WHERE game_id = ?`, [
				last.id,
			]);
			await cloudflare.execute(`DELETE FROM games WHERE id = ?`, [last.id]);
			for (const c of mmrChanges) {
				await cloudflare.execute(
					`UPDATE user_lane_mmr SET mmr = mmr - ? WHERE user_id = ? AND role = ? AND season_id = ?`,
					[c.delta, c.user_id, c.role, c.season_id],
				);
			}

			// 시리즈가 COMPLETED 였으면 IN_PROGRESS 로 복원
			if (s.status === "COMPLETED") {
				await cloudflare.execute(
					`UPDATE series SET status = 'IN_PROGRESS', winning_team = NULL, ended_at = NULL WHERE id = ?`,
					[id],
				);
			}

			invalidate(`series:${id}`);
			invalidate("dashboard");
			return { ok: true, deletedGame: last.game_number };
		},
	);

	// 픽/밴 draft 저장 (full replace) — guild_kv 에 JSON 으로 보관
	app.put<{ Params: { id: string }; Body: unknown }>(
		"/api/series/:id/pickban",
		async (req, reply) => {
			const sid = await requireEditor(req, reply);
			if (!sid) return;

			const id = Number(req.params.id);
			if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });
			const s = await db.getSeries(id);
			if (!s) return reply.code(404).send({ error: "not found" });
			if (s.status !== "IN_PROGRESS") {
				return reply.code(409).send({ error: `series status is ${s.status}` });
			}

			await db.setKv(`pickban:${id}`, JSON.stringify(req.body), sid);
			// originUser 포함 broadcast — 본인 origin 인 클라이언트는 reload 무시 (입력 보호)
			invalidate(`series:${id}`, sid);
			return { ok: true };
		},
	);

	// 시리즈를 엔트리 수정 대기 상태로 되돌리기 — 게임이 하나도 없을 때만 허용
	app.post<{ Params: { id: string } }>(
		"/api/series/:id/revert",
		async (req, reply) => {
			const sid = await requireEditor(req, reply);
			if (!sid) return;

			const id = Number(req.params.id);
			if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });
			const s = await db.getSeries(id);
			if (!s) return reply.code(404).send({ error: "not found" });
			if (s.status !== "IN_PROGRESS") {
				return reply.code(409).send({ error: `series status is ${s.status}` });
			}
			const games = await db.listGamesInSeries(id);
			if (games.length > 0) {
				return reply.code(409).send({
					error: `이미 ${games.length}개 게임이 기록된 시리즈는 되돌릴 수 없습니다.`,
				});
			}

			// 모집 찾기 (converted_series_id = id)
			const recRow = await cloudflare.queryOne<{ id: number }>(
				`SELECT id FROM recruitments WHERE converted_series_id = ?`,
				[id],
			);

			// 순서 중요 — recruitments.converted_series_id 가 series.id 를 FK 로 참조하므로
			// 1) 모집 status 복원 + converted_series_id NULL 로 설정 (FK 해제)
			// 2) 그 다음 시리즈 DELETE (CASCADE 로 series_participants 정리)
			if (recRow) {
				await db.setRecruitmentStatus(recRow.id, "CLOSED");
			}
			await cloudflare.execute(`DELETE FROM series WHERE id = ?`, [id]);
			await db.deleteKv(`pickban:${id}`);

			invalidate(`series:${id}`);
			invalidate("dashboard");
			if (recRow) invalidate(`recruitment:${recRow.id}`);
			return { ok: true, recruitmentId: recRow?.id ?? null };
		},
	);

	// Champion 전체 리스트 (Data Dragon) — iconUrl 은 /dd/ 프록시 경로로 변환
	app.get("/api/champions", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;

		return {
			champions: datadragon
				.getAllChampions()
				.map((c) => ({ ...c, iconUrl: rewriteDD(c.iconUrl) })),
		};
	});

	// 엔트리 슬롯 배정 draft 저장 — guild_kv 에 JSON. 다른 운영자에게 즉시 broadcast (origin 제외).
	app.put<{ Params: { id: string }; Body: unknown }>(
		"/api/recruitments/:id/entry-draft",
		async (req, reply) => {
			const sid = await requireEditor(req, reply);
			if (!sid) return;
			const id = Number(req.params.id);
			if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });
			const rec = await getRecruitment(id);
			if (!rec) return reply.code(404).send({ error: "not found" });
			await db.setKv(`entry:${id}`, JSON.stringify(req.body), sid);
			invalidate(`recruitment:${id}`, sid);
			return { ok: true };
		},
	);

	// 단일 모집 상세 — 참가자 + 라인 선호 + 엔트리 draft
	app.get<{ Params: { id: string } }>("/api/recruitments/:id", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;

		const id = Number(req.params.id);
		if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });

		const rec = await getRecruitment(id);
		if (!rec) return reply.code(404).send({ error: "not found" });

		const participants = await listRecruitmentParticipants(id);
		const userIds = participants.map((p) => p.user_id);
		const users = await db.listUsers(userIds);
		const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));

		const stats = await fetchPlayHistoryFor(userIds);

		const entryDraftRaw = await db.getKv(`entry:${id}`);
		let entryDraft: unknown = null;
		if (entryDraftRaw) {
			try {
				entryDraft = JSON.parse(entryDraftRaw);
			} catch {
				entryDraft = null;
			}
		}

		return {
			recruitment: {
				id: rec.id,
				targetCount: rec.target_count,
				status: rec.status,
				createdBy: rec.created_by,
				createdAt: rec.created_at,
			},
			participants: participants.map((p) => ({
				userId: p.user_id,
				displayName: nameById.get(p.user_id) ?? p.user_id,
				roles: p.roles,
				joinedAt: p.joined_at,
				history: stats.get(p.user_id) ?? emptyHistory(),
			})),
			entryDraft,
		};
	});
}

interface WL {
	plays: number;
	wins: number;
	losses: number;
}

interface ChampionPlay extends WL {
	championId: number;
	championName: string;
	iconUrl: string;
}

interface RolePlay extends WL {
	role: string;
}

interface PlayHistory {
	total: WL;
	topChampions: ChampionPlay[]; // 가장 많이 플레이한 챔프 top 5
	rolePlays: RolePlay[];        // 라인별 W/L (count 기준 desc)
	topRole: RolePlay | null;
}

function emptyHistory(): PlayHistory {
	return {
		total: { plays: 0, wins: 0, losses: 0 },
		topChampions: [],
		rolePlays: [],
		topRole: null,
	};
}

/**
 * 여러 사용자의 game_stats 집계를 한 번에 — 1쿼리 챔프, 1쿼리 라인.
 * 초보 / 신규 사용자는 빈 PlayHistory.
 */
async function fetchPlayHistoryFor(userIds: string[]): Promise<Map<string, PlayHistory>> {
	const result = new Map<string, PlayHistory>();
	if (userIds.length === 0) return result;
	for (const id of userIds) result.set(id, emptyHistory());

	const placeholders = userIds.map(() => "?").join(",");

	// 챔피언별 W/L — game_stats JOIN games
	const champRows = await cloudflare.query<{
		user_id: string;
		champion_id: number;
		plays: number;
		wins: number;
	}>(
		`SELECT
		   gs.user_id,
		   gs.champion_id,
		   COUNT(*) AS plays,
		   SUM(CASE WHEN g.winning_team = gs.team THEN 1 ELSE 0 END) AS wins
		 FROM game_stats gs
		 JOIN games g ON g.id = gs.game_id
		 WHERE gs.user_id IN (${placeholders}) AND gs.champion_id IS NOT NULL
		 GROUP BY gs.user_id, gs.champion_id`,
		userIds,
	);

	// 라인별 W/L
	const roleRows = await cloudflare.query<{
		user_id: string;
		role: string;
		plays: number;
		wins: number;
	}>(
		`SELECT
		   gs.user_id,
		   gs.role,
		   COUNT(*) AS plays,
		   SUM(CASE WHEN g.winning_team = gs.team THEN 1 ELSE 0 END) AS wins
		 FROM game_stats gs
		 JOIN games g ON g.id = gs.game_id
		 WHERE gs.user_id IN (${placeholders})
		 GROUP BY gs.user_id, gs.role`,
		userIds,
	);

	const champByUser = new Map<string, ChampionPlay[]>();
	for (const r of champRows) {
		const list = champByUser.get(r.user_id) ?? [];
		list.push({
			championId: r.champion_id,
			championName: datadragon.getChampionName(r.champion_id),
			iconUrl: rewriteDD(datadragon.getChampionImageUrl(r.champion_id)),
			plays: r.plays,
			wins: r.wins,
			losses: r.plays - r.wins,
		});
		champByUser.set(r.user_id, list);
	}
	for (const [uid, list] of champByUser) {
		list.sort((a, b) => b.plays - a.plays);
		const h = result.get(uid)!;
		h.topChampions = list.slice(0, 5);
	}

	const roleByUser = new Map<string, RolePlay[]>();
	for (const r of roleRows) {
		const list = roleByUser.get(r.user_id) ?? [];
		list.push({
			role: r.role,
			plays: r.plays,
			wins: r.wins,
			losses: r.plays - r.wins,
		});
		roleByUser.set(r.user_id, list);
	}
	for (const [uid, list] of roleByUser) {
		list.sort((a, b) => b.plays - a.plays);
		const h = result.get(uid)!;
		h.rolePlays = list;
		h.topRole = list[0] ?? null;
		const total = list.reduce(
			(acc, r) => ({
				plays: acc.plays + r.plays,
				wins: acc.wins + r.wins,
				losses: acc.losses + r.losses,
			}),
			{ plays: 0, wins: 0, losses: 0 },
		);
		h.total = total;
	}

	return result;
}
