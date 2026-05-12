// 시리즈 종료 카드 — Bo3 종료 시 모집 채널에 결과 요약을 V2 메시지로 발행.
//
// 흐름:
//   api 의 completeSeries() 직후 → notifyBotSeriesCompleted(seriesId)
//     → 봇 /internal/series-completed → publishSeriesEndCard(client, seriesId)
//
// 멱등성: series.end_card_message_id 가 있으면 edit, 없으면 send + DB 갱신.
// (revert + 재완료 시 같은 채널의 같은 메시지가 갱신됨.)

import { db } from "@mookbot/core";
import {
	type ActionRowBuilder,
	type ButtonBuilder,
	type Client,
	type ContainerBuilder,
	MessageFlags,
	type StringSelectMenuBuilder,
} from "discord.js";
import { COLORS, v2Container, v2Sep, v2Text } from "../../utils/v2.js";

const ROLE_LABEL: Record<string, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};
const ROLE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;

/**
 * 시리즈 종료 카드 components 빌드. DB 에서 series + games + picks + participants
 * + display name 을 모두 fetch 해서 한 화면에 응집.
 *
 * 시리즈가 COMPLETED 가 아니거나 winning_team 이 NULL 이면 null 반환 (메시지 발행 X).
 */
export async function renderEndCardComponents(
	seriesId: number,
): Promise<Array<
	ContainerBuilder | ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>
> | null> {
	const series = await db.getSeries(seriesId);
	if (!series) return null;
	if (series.status !== "COMPLETED" || !series.winning_team) return null;

	const [parts, games, picksAndBans] = await Promise.all([
		db.getSeriesParticipants(seriesId),
		db.listGamesInSeries(seriesId),
		db.getSeriesPicksAndBans(seriesId),
	]);

	const userIds = parts.map((p) => p.user_id);
	const users = userIds.length > 0 ? await db.listUsers(userIds) : [];
	const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));

	// team / role → user 매핑
	const userByTeamRole = new Map<string, string>();
	for (const p of parts) userByTeamRole.set(`${p.team}_${p.role}`, p.user_id);

	const t1Wins = games.filter((g) => g.winning_team === "TEAM_1").length;
	const t2Wins = games.filter((g) => g.winning_team === "TEAM_2").length;
	const winningTeam = series.winning_team;
	const winnerLabel = winningTeam === "TEAM_1" ? "1팀" : "2팀";
	const teamSize = parts.length / 2;
	const activeRoles = ROLE_ORDER.filter((r) => userByTeamRole.has(`TEAM_1_${r}`));

	// 라인업 — 라인별 1팀 / 2팀
	const lineupLines = activeRoles.map((role) => {
		const u1 = userByTeamRole.get(`TEAM_1_${role}`);
		const u2 = userByTeamRole.get(`TEAM_2_${role}`);
		const n1 = u1 ? (nameById.get(u1) ?? u1) : "—";
		const n2 = u2 ? (nameById.get(u2) ?? u2) : "—";
		return `\`${ROLE_LABEL[role]?.padEnd(2, " ") ?? role}\` **${n1}** vs **${n2}**`;
	});

	// 게임별 결과 + 픽 — 라인별 챔프 한 줄씩
	const picksByGameAndSlot = new Map<string, string>();
	for (const p of picksAndBans.picks) {
		picksByGameAndSlot.set(`${p.game_id}_${p.team}_${p.role}`, p.champion_name);
	}
	const gameSections: string[] = games.map((g) => {
		const sideOf = (team: "TEAM_1" | "TEAM_2") => {
			if (team === "TEAM_1") return g.team1_side;
			return g.team1_side === "BLUE" ? "RED" : "BLUE";
		};
		const winnerBadge = g.winning_team === "TEAM_1" ? "🔵 1팀 승" : "🔴 2팀 승";
		const dur = g.duration_sec != null ? ` · ${Math.round(g.duration_sec / 60)}분` : "";
		const lines = activeRoles.map((role) => {
			const c1 = picksByGameAndSlot.get(`${g.id}_TEAM_1_${role}`) ?? "—";
			const c2 = picksByGameAndSlot.get(`${g.id}_TEAM_2_${role}`) ?? "—";
			return `\`${ROLE_LABEL[role]?.padEnd(2, " ") ?? role}\` ${c1} vs ${c2}`;
		});
		const sideLine = `1팀 ${sideOf("TEAM_1")} · 2팀 ${sideOf("TEAM_2")}`;
		return `**Game ${g.game_number}** — ${winnerBadge}${dur}\n${sideLine}\n${lines.join("\n")}`;
	});

	const color = winningTeam === "TEAM_1" ? COLORS.info : COLORS.error;

	const children = [
		v2Text(`## 🏆 시리즈 #${series.id} 종료 — ${winnerLabel} 우승 (${t1Wins} : ${t2Wins})`),
		v2Text(`Bo3 · ${teamSize}v${teamSize} · ${games.length}게임`),
		v2Sep(),
		v2Text(`### 라인업\n${lineupLines.join("\n")}`),
	];
	for (const section of gameSections) {
		children.push(v2Sep(), v2Text(section));
	}

	return [v2Container({ color, children })];
}

/**
 * 시리즈 종료 카드를 모집 채널에 발행. edit-or-send 멱등 처리.
 * 실패 사유를 string 반환 (성공 시 null).
 *
 * - 모집 channel_id 없으면 skip (외부 트리거된 시리즈 / 오래된 모집).
 * - end_card_message_id 있으면 edit. fetch 실패 (Missing Access / Unknown Message)
 *   시 새 send 로 폴백 + DB 갱신.
 */
export async function publishSeriesEndCard(
	client: Client,
	seriesId: number,
): Promise<string | null> {
	// 모집 channel_id = 시리즈 발행 채널. v0.3.4 부터 series.id == recruitment.id.
	const recruitment = await db.getRecruitment(seriesId);
	if (!recruitment) return `recruitment ${seriesId} not found`;
	const channelId = recruitment.channel_id;
	if (!channelId) return "recruitment has no channel_id (skip)";

	const components = await renderEndCardComponents(seriesId);
	if (!components) return "series not in COMPLETED state (skip)";

	const series = await db.getSeries(seriesId);
	const existingMessageId = series?.end_card_message_id ?? null;
	const existingChannelId = series?.end_card_channel_id ?? channelId;

	// 1차 — 기존 메시지 edit
	if (existingMessageId) {
		try {
			const ch = await client.channels.fetch(existingChannelId);
			if (ch?.isTextBased() && "messages" in ch) {
				const msg = await ch.messages.fetch(existingMessageId);
				await msg.edit({
					flags: MessageFlags.IsComponentsV2,
					components,
				} as Parameters<typeof msg.edit>[0]);
				return null;
			}
		} catch (err) {
			// 메시지 사라졌거나 권한 없으면 새로 send 로 폴백 (아래로)
			const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
			if (!isAccessOrMissingError(err)) {
				return `end-card edit 실패: ${detail}`;
			}
			// fallthrough → new send
		}
	}

	// 2차 — 새 메시지 send (모집 채널)
	try {
		const ch = await client.channels.fetch(channelId);
		if (!ch?.isTextBased() || !("send" in ch)) {
			return "모집 채널 접근 불가 (텍스트 채널 아님)";
		}
		const newMsg = await ch.send({
			flags: MessageFlags.IsComponentsV2,
			components,
		} as Parameters<typeof ch.send>[0]);
		await db.setSeriesEndMessage(seriesId, newMsg.channelId, newMsg.id);
		return null;
	} catch (err) {
		const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
		return `end-card send 실패: ${detail}`;
	}
}

function isAccessOrMissingError(err: unknown): boolean {
	if (!(err instanceof Error)) return false;
	return (
		/50001|10008|50013/.test(err.message) ||
		/50001|10008|50013/.test(err.name) ||
		[50001, 10008, 50013].includes((err as { code?: number }).code ?? -1)
	);
}
