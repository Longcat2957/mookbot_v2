// 경매내전 토너먼트 매치 진행 — BRACKET_SETUP / IN_GAME / COMPLETED.
// 매치 생성 + BO1/BO3 선택 + 라인 자유 픽 + 게임 결과 입력 + 자동 결승.

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api/rest.js";
import { wsClient } from "../../api/ws.js";
import { ConfirmButton } from "../../components/ConfirmButton.js";
import { usePerms } from "../../state/perms.js";
import { useStaleWhileRevalidate } from "../../state/useStaleWhileRevalidate.js";
import { ChampPickerModal } from "./ChampPickerModal.js";
import type { AuctionMatch, AuctionTournamentDetail, MatchFormat } from "./types.js";
import { useAuctionState } from "./useAuctionState.js";

const ROLE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;
type Role = (typeof ROLE_ORDER)[number];

interface Champion {
	id: number;
	idSlug: string;
	name: string;
	iconUrl: string;
}

interface SeriesDetail {
	series: {
		id: number;
		status: string;
		winningTeam: "TEAM_1" | "TEAM_2" | null;
	};
	games: {
		id: number;
		gameNumber: number;
		team1Side: "BLUE" | "RED";
		winningTeam: "TEAM_1" | "TEAM_2";
		durationSec: number | null;
		picks: { team: "TEAM_1" | "TEAM_2"; role: string; championName: string }[];
		bans?: { team: "TEAM_1" | "TEAM_2"; position: number; championName: string }[];
	}[];
}

export function AuctionBracket({
	tournamentId,
	onCompleted,
}: {
	tournamentId: number | null;
	onCompleted: () => void;
}) {
	const perms = usePerms();
	const s = useAuctionState(tournamentId);

	useEffect(() => {
		if (s.detail?.tournament.status === "COMPLETED") onCompleted();
	}, [s.detail?.tournament.status, onCompleted]);

	if (!tournamentId) return <div className="alert alert-warning">토너먼트 ID 없음</div>;
	if (s.error) return <div className="alert alert-error">{s.error}</div>;
	if (!s.detail) return <div className="alert alert-info">로딩 중…</div>;

	const matches = s.detail.matches;
	const semis = matches.filter((m) => m.round === "SEMI");
	const finalOrSingle = matches.find((m) => m.round === "FINAL" || m.round === "SINGLE");
	// 4강 매치업 동시 진행 가능 — 첫 SEMI 만들고 IN_GAME 으로 전환된 후에도
	// 두 번째 SEMI 만들기 위해 setup 노출 유지. 20인 = SEMI 2개 다 만들어질 때까지,
	// 10인 = SINGLE 1개 만들어질 때까지.
	const isSetup =
		s.detail.tournament.status === "BRACKET_SETUP" ||
		(s.detail.tournament.status === "IN_GAME" &&
			((s.detail.tournament.format === 20 && semis.length < 2) ||
				(s.detail.tournament.format === 10 && matches.length === 0)));

	return (
		<section className="space-y-3">
			<header className="flex items-center justify-between flex-wrap gap-2">
				<div>
					<h2 className="text-xl font-bold">🎟️ 경매내전 #{s.detail.tournament.id} 토너먼트</h2>
					<p className="text-xs text-base-content/70">
						{s.detail.tournament.format}인 · 단계: {s.detail.tournament.status}
					</p>
				</div>
				<div className="flex items-center gap-1">
					<button type="button" className="btn btn-ghost btn-sm" onClick={s.refresh}>
						↻
					</button>
					{perms.canEdit && s.detail.tournament.status !== "COMPLETED" && (
						<ConfirmButton
							label="⛔ 토너먼트 강제 취소"
							onConfirm={s.cancel}
							variant="error"
							className="btn-sm"
						/>
					)}
				</div>
			</header>

			{/* BRACKET_SETUP — 운영자가 매치업 구성 */}
			{isSetup && perms.canEdit && <MatchSetup detail={s.detail} onCreate={s.createMatch} />}

			{/* 매치 카드 — SEMI 또는 SINGLE 또는 FINAL */}
			{(s.detail.tournament.format === 20 ? semis : matches).length > 0 && (
				<div className="space-y-2">
					<h3 className="font-bold">{s.detail.tournament.format === 20 ? "4강" : "매치"}</h3>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						{(s.detail.tournament.format === 20 ? semis : matches).map((m) => (
							<MatchCard key={m.seriesId} match={m} detail={s.detail!} canEdit={perms.canEdit} />
						))}
					</div>
				</div>
			)}

			{/* 결승 (20인만) — 4강 둘 다 끝나면 운영자가 생성 */}
			{s.detail.tournament.format === 20 && (
				<div className="space-y-2">
					<h3 className="font-bold">결승</h3>
					{finalOrSingle ? (
						<MatchCard match={finalOrSingle} detail={s.detail} canEdit={perms.canEdit} />
					) : (
						perms.canEdit && <FinalSetup detail={s.detail} semis={semis} onCreate={s.createMatch} />
					)}
				</div>
			)}
		</section>
	);
}

// ============================================================
// MatchSetup — 4강 매치업 구성 (20인) 또는 단일 매치 (10인)
// ============================================================
function MatchSetup({
	detail,
	onCreate,
}: {
	detail: AuctionTournamentDetail;
	onCreate: (input: {
		round: "SEMI" | "FINAL" | "SINGLE";
		bracketIndex: number | null;
		team1Id: number;
		team2Id: number;
		format: MatchFormat;
	}) => Promise<{ seriesId: number }>;
}) {
	const [format, setFormat] = useState<MatchFormat>("BO3");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const allTeams = detail.teams;
	const remaining = allTeams.filter(
		(t) => !detail.matches.some((m) => m.team1Id === t.id || m.team2Id === t.id),
	);

	const createSemi = async (team1Id: number, team2Id: number) => {
		setSubmitting(true);
		setError(null);
		try {
			const semiCount = detail.matches.filter((m) => m.round === "SEMI").length;
			await onCreate({
				round: "SEMI",
				bracketIndex: semiCount + 1,
				team1Id,
				team2Id,
				format,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	const createSingle = async (team1Id: number, team2Id: number) => {
		setSubmitting(true);
		setError(null);
		try {
			await onCreate({
				round: "SINGLE",
				bracketIndex: null,
				team1Id,
				team2Id,
				format,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	// 10인 — 1매치만, 2팀
	if (detail.tournament.format === 10) {
		if (detail.matches.length > 0 || allTeams.length !== 2) return null;
		const [t1, t2] = allTeams;
		return (
			<div className="card bg-base-200">
				<div className="card-body p-4 gap-2">
					<h3 className="font-bold">매치 생성</h3>
					<FormatSelect value={format} onChange={setFormat} />
					<div className="text-sm">
						<strong>{t1?.captainName}</strong> vs <strong>{t2?.captainName}</strong>
					</div>
					{error && <div className="alert alert-error alert-sm">{error}</div>}
					<button
						type="button"
						className="btn btn-primary"
						onClick={() => t1 && t2 && createSingle(t1.id, t2.id)}
						disabled={submitting}
					>
						▶ 매치 시작
					</button>
				</div>
			</div>
		);
	}

	// 20인 — 4강 매치업 2개. 운영자가 짝짓기 (Q3 결정: 수동)
	if (remaining.length === 0) return null;
	return (
		<div className="card bg-base-200">
			<div className="card-body p-4 gap-2">
				<h3 className="font-bold">4강 매치업 구성 ({remaining.length}/4 팀 남음)</h3>
				<FormatSelect value={format} onChange={setFormat} />
				<MatchupBuilder teams={remaining} onPair={createSemi} submitting={submitting} />
				{error && <div className="alert alert-error alert-sm">{error}</div>}
			</div>
		</div>
	);
}

function FinalSetup({
	detail,
	semis,
	onCreate,
}: {
	detail: AuctionTournamentDetail;
	semis: AuctionMatch[];
	onCreate: (input: {
		round: "FINAL";
		bracketIndex: null;
		team1Id: number;
		team2Id: number;
		format: MatchFormat;
	}) => Promise<{ seriesId: number }>;
}) {
	const [format, setFormat] = useState<MatchFormat>("BO3");
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// 4강 둘 다 완료된 시리즈에서 winner 가져오기
	const winners = useFinalParticipants(detail, semis);

	if (!winners) return <div className="text-sm text-base-content/60">_(4강 결과 대기 중)_</div>;

	const [t1Id, t2Id] = winners;
	const t1 = detail.teams.find((t) => t.id === t1Id);
	const t2 = detail.teams.find((t) => t.id === t2Id);

	const create = async () => {
		setCreating(true);
		setError(null);
		try {
			await onCreate({ round: "FINAL", bracketIndex: null, team1Id: t1Id, team2Id: t2Id, format });
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setCreating(false);
		}
	};

	return (
		<div className="card bg-base-200">
			<div className="card-body p-4 gap-2">
				<h3 className="font-bold">결승 생성</h3>
				<FormatSelect value={format} onChange={setFormat} />
				<div className="text-sm">
					<strong>{t1?.captainName ?? `팀${t1?.teamIndex}`}</strong> vs{" "}
					<strong>{t2?.captainName ?? `팀${t2?.teamIndex}`}</strong>
				</div>
				{error && <div className="alert alert-error alert-sm">{error}</div>}
				<button type="button" className="btn btn-primary" onClick={create} disabled={creating}>
					▶ 결승 시작
				</button>
			</div>
		</div>
	);
}

function useFinalParticipants(
	_detail: AuctionTournamentDetail,
	semis: AuctionMatch[],
): [number, number] | null {
	// 각 4강 매치 series 를 SWR + WS subscribe 로 reactive 하게 추적 — 매치 결과
	// 변경 시 즉시 재계산. 기존 useEffect 는 semis 배열 자체가 같으면 (id 동일) 재실행
	// 안 돼 4강 끝나도 결승 진입 불가던 버그 fix.
	const m1Id = semis[0]?.seriesId ?? null;
	const m2Id = semis[1]?.seriesId ?? null;

	const m1Fetcher = useCallback(
		() =>
			m1Id !== null
				? api<SeriesDetail>(`/series/${m1Id}`)
				: Promise.reject(new Error("no semi 1")),
		[m1Id],
	);
	const m2Fetcher = useCallback(
		() =>
			m2Id !== null
				? api<SeriesDetail>(`/series/${m2Id}`)
				: Promise.reject(new Error("no semi 2")),
		[m2Id],
	);
	const m1Swr = useStaleWhileRevalidate<SeriesDetail>(m1Id, m1Fetcher, {
		enabled: m1Id !== null,
	});
	const m2Swr = useStaleWhileRevalidate<SeriesDetail>(m2Id, m2Fetcher, {
		enabled: m2Id !== null,
	});

	useEffect(() => {
		if (m1Id === null) return;
		return wsClient.subscribe(`auction-match:${m1Id}`, () => m1Swr.refresh());
	}, [m1Id, m1Swr]);
	useEffect(() => {
		if (m2Id === null) return;
		return wsClient.subscribe(`auction-match:${m2Id}`, () => m2Swr.refresh());
	}, [m2Id, m2Swr]);

	if (
		semis.length !== 2 ||
		!m1Swr.data ||
		!m2Swr.data ||
		m1Swr.data.series.status !== "COMPLETED" ||
		m2Swr.data.series.status !== "COMPLETED" ||
		!m1Swr.data.series.winningTeam ||
		!m2Swr.data.series.winningTeam
	) {
		return null;
	}
	const w1 = m1Swr.data.series.winningTeam === "TEAM_1" ? semis[0]!.team1Id : semis[0]!.team2Id;
	const w2 = m2Swr.data.series.winningTeam === "TEAM_1" ? semis[1]!.team1Id : semis[1]!.team2Id;
	return [w1, w2];
}

function FormatSelect({
	value,
	onChange,
}: {
	value: MatchFormat;
	onChange: (v: MatchFormat) => void;
}) {
	return (
		<div className="join">
			<button
				type="button"
				className={`btn btn-sm join-item ${value === "BO1" ? "btn-primary" : "btn-ghost"}`}
				onClick={() => onChange("BO1")}
			>
				BO1
			</button>
			<button
				type="button"
				className={`btn btn-sm join-item ${value === "BO3" ? "btn-primary" : "btn-ghost"}`}
				onClick={() => onChange("BO3")}
			>
				BO3
			</button>
		</div>
	);
}

function MatchupBuilder({
	teams,
	onPair,
	submitting,
}: {
	teams: AuctionTournamentDetail["teams"];
	onPair: (team1Id: number, team2Id: number) => Promise<void>;
	submitting: boolean;
}) {
	const [t1, setT1] = useState<number | null>(null);
	const [t2, setT2] = useState<number | null>(null);

	const submit = async () => {
		if (!t1 || !t2 || t1 === t2) return;
		await onPair(t1, t2);
		setT1(null);
		setT2(null);
	};

	return (
		<div className="space-y-2">
			<div className="flex gap-2 flex-wrap">
				{teams.map((t) => (
					<button
						key={t.id}
						type="button"
						onClick={() => {
							if (t1 === t.id) setT1(null);
							else if (t2 === t.id) setT2(null);
							else if (t1 === null) setT1(t.id);
							else if (t2 === null) setT2(t.id);
						}}
						className={`btn btn-sm ${
							t1 === t.id ? "btn-info" : t2 === t.id ? "btn-error" : "btn-outline"
						}`}
					>
						{t1 === t.id && <span className="badge badge-xs">1</span>}
						{t2 === t.id && <span className="badge badge-xs">2</span>}팀{t.teamIndex} {t.captainName}
					</button>
				))}
			</div>
			<button
				type="button"
				className="btn btn-sm btn-primary"
				onClick={submit}
				disabled={!t1 || !t2 || submitting}
			>
				매치업 생성
			</button>
		</div>
	);
}

// ============================================================
// MatchCard — 매치 진행 (게임 결과 입력 / picks-bans)
// ============================================================
function MatchCard({
	match,
	detail,
	canEdit,
}: {
	match: AuctionMatch;
	detail: AuctionTournamentDetail;
	canEdit: boolean;
}) {
	const t1 = detail.teams.find((t) => t.id === match.team1Id);
	const t2 = detail.teams.find((t) => t.id === match.team2Id);
	const [expanded, setExpanded] = useState(false);

	const seriesFetcher = useMemo(
		() => () => api<SeriesDetail>(`/series/${match.seriesId}`),
		[match.seriesId],
	);
	const swr = useStaleWhileRevalidate<SeriesDetail>(
		`auction-match:${match.seriesId}`,
		seriesFetcher,
	);

	const seriesData = swr.data;
	const games = seriesData?.games ?? [];
	const completed = seriesData?.series.status === "COMPLETED";
	const winningTeam = seriesData?.series.winningTeam ?? null;

	const t1Wins = games.filter((g) => g.winningTeam === "TEAM_1").length;
	const t2Wins = games.filter((g) => g.winningTeam === "TEAM_2").length;

	return (
		<div className={`card bg-base-200 ${completed ? "border border-success" : ""}`}>
			<div className="card-body p-3 gap-2">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className="badge badge-sm">{match.round}</span>
						<span className="badge badge-sm badge-ghost">{match.format}</span>
					</div>
					{completed && winningTeam && (
						<span className="badge badge-success badge-sm">
							🏆 팀{winningTeam === "TEAM_1" ? t1?.teamIndex : t2?.teamIndex} 승
						</span>
					)}
				</div>
				<div className="flex items-center justify-center gap-4 py-2 tabular-nums">
					<div className="text-right">
						<div className="text-xs text-info">팀{t1?.teamIndex}</div>
						<div className="font-bold">{t1?.captainName}</div>
					</div>
					<div className="text-2xl font-bold">
						<span className={winningTeam === "TEAM_1" ? "text-info" : ""}>{t1Wins}</span>
						<span className="opacity-30 mx-2">:</span>
						<span className={winningTeam === "TEAM_2" ? "text-error" : ""}>{t2Wins}</span>
					</div>
					<div className="text-left">
						<div className="text-xs text-error">팀{t2?.teamIndex}</div>
						<div className="font-bold">{t2?.captainName}</div>
					</div>
				</div>
				{canEdit && !completed && (
					<div className="flex gap-1.5 flex-wrap">
						<button
							type="button"
							className="btn btn-sm btn-primary flex-1"
							onClick={() => setExpanded((v) => !v)}
						>
							{expanded ? "접기" : `Game ${games.length + 1} 입력`}
						</button>
						{games.length === 0 && (
							<MatchFormatToggle
								seriesId={match.seriesId}
								format={match.format}
								onChanged={() => swr.refresh()}
							/>
						)}
						{games.length > 0 && (
							<ConfirmButton
								label="↺ 직전 게임"
								onConfirm={async () => {
									await api(`/auction-matches/${match.seriesId}/games/last`, {
										method: "DELETE",
									});
									swr.refresh();
								}}
								variant="error"
								className="btn-sm"
							/>
						)}
					</div>
				)}
				{expanded && t1 && t2 && (
					<GameInputForm
						match={match}
						team1={t1}
						team2={t2}
						games={games}
						onRecorded={() => swr.refresh()}
					/>
				)}
				{/* 게임별 요약 */}
				{games.length > 0 && (
					<details className="collapse collapse-arrow bg-base-100/40 mt-1">
						<summary className="collapse-title text-xs py-1 min-h-0">게임 ({games.length})</summary>
						<div className="collapse-content text-xs">
							{games.map((g) => (
								<div key={g.id} className="py-1">
									<strong>Game {g.gameNumber}</strong> · {g.winningTeam === "TEAM_1" ? "1팀 승" : "2팀 승"} ·{" "}
									{g.team1Side}
								</div>
							))}
						</div>
					</details>
				)}
			</div>
		</div>
	);
}

// ============================================================
// MatchFormatToggle — 게임 0개일 때만 BO1/BO3 변경 가능
// ============================================================
function MatchFormatToggle({
	seriesId,
	format,
	onChanged,
}: {
	seriesId: number;
	format: MatchFormat;
	onChanged: () => void;
}) {
	const [submitting, setSubmitting] = useState(false);
	const toggle = async () => {
		setSubmitting(true);
		try {
			await api(`/auction-matches/${seriesId}/format`, {
				method: "PUT",
				body: JSON.stringify({ format: format === "BO1" ? "BO3" : "BO1" }),
			});
			onChanged();
		} catch {
		} finally {
			setSubmitting(false);
		}
	};
	return (
		<button
			type="button"
			className="btn btn-sm btn-ghost"
			onClick={toggle}
			disabled={submitting}
			title="BO1 / BO3 변경 (게임 미시작 시만)"
		>
			↔ {format === "BO1" ? "BO3 로" : "BO1 로"}
		</button>
	);
}

// ============================================================
// GameInputForm — 라인 자유 픽 (Q8): 각 팀 5명을 5라인에 자유 배치 + 챔프 그리드 모달.
// BAN 5개/팀 입력 포함.
// ============================================================
function GameInputForm({
	match,
	team1,
	team2,
	games,
	onRecorded,
}: {
	match: AuctionMatch;
	team1: AuctionTournamentDetail["teams"][number];
	team2: AuctionTournamentDetail["teams"][number];
	games: SeriesDetail["games"];
	onRecorded: () => void;
}) {
	const nextGameNumber = (games.length + 1) as 1 | 2 | 3;
	const [team1Side, setTeam1Side] = useState<"BLUE" | "RED">("BLUE");
	const [winningTeam, setWinningTeam] = useState<"TEAM_1" | "TEAM_2">("TEAM_1");
	const [assign, setAssign] = useState<Record<"TEAM_1" | "TEAM_2", Partial<Record<Role, string>>>>({
		TEAM_1: {},
		TEAM_2: {},
	});
	const [picks, setPicks] = useState<Record<"TEAM_1" | "TEAM_2", Partial<Record<Role, number>>>>({
		TEAM_1: {},
		TEAM_2: {},
	});
	const [bans, setBans] = useState<Record<"TEAM_1" | "TEAM_2", number[]>>({
		TEAM_1: [],
		TEAM_2: [],
	});

	const [champions, setChampions] = useState<Champion[]>([]);
	useEffect(() => {
		(async () => {
			try {
				const r = await api<{ champions: Champion[] }>("/champions");
				setChampions(r.champions);
			} catch {}
		})();
	}, []);
	const champById = useMemo(() => new Map(champions.map((c) => [c.id, c])), [champions]);

	// 챔프 모달 — 어느 slot 을 선택 중인지 추적
	const [picker, setPicker] = useState<
		| null
		| { kind: "pick"; team: "TEAM_1" | "TEAM_2"; role: Role }
		| { kind: "ban"; team: "TEAM_1" | "TEAM_2"; index: number }
	>(null);

	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const team1Members = team1.members;
	const team2Members = team2.members;

	// 모든 슬롯에 사용된 챔프 id (중복 방지)
	const usedChampIds = useMemo(() => {
		const set = new Set<number>();
		for (const team of ["TEAM_1", "TEAM_2"] as const) {
			for (const role of ROLE_ORDER) {
				const c = picks[team][role];
				if (c != null) set.add(c);
			}
			for (const b of bans[team]) if (b != null) set.add(b);
		}
		return set;
	}, [picks, bans]);

	const updateAssign = (team: "TEAM_1" | "TEAM_2", role: Role, userId: string | undefined) => {
		setAssign((prev) => ({ ...prev, [team]: { ...prev[team], [role]: userId } }));
	};

	const setPick = (team: "TEAM_1" | "TEAM_2", role: Role, championId: number) => {
		setPicks((prev) => ({ ...prev, [team]: { ...prev[team], [role]: championId } }));
	};
	const setBan = (team: "TEAM_1" | "TEAM_2", index: number, championId: number) => {
		setBans((prev) => {
			const arr = [...prev[team]];
			arr[index] = championId;
			return { ...prev, [team]: arr };
		});
	};
	const removeBan = (team: "TEAM_1" | "TEAM_2", index: number) => {
		setBans((prev) => {
			const arr = [...prev[team]];
			arr.splice(index, 1);
			return { ...prev, [team]: arr };
		});
	};

	const submit = async () => {
		for (const team of ["TEAM_1", "TEAM_2"] as const) {
			for (const role of ROLE_ORDER) {
				if (!assign[team][role]) {
					setError(`${team} ${role} 사용자 미지정`);
					return;
				}
				if (!picks[team][role]) {
					setError(`${team} ${role} 챔프 미지정`);
					return;
				}
			}
			const userIds = Object.values(assign[team]);
			if (new Set(userIds).size !== userIds.length) {
				setError(`${team} 안에 같은 사용자 중복`);
				return;
			}
		}
		setSubmitting(true);
		setError(null);
		try {
			await api(`/auction-matches/${match.seriesId}/games`, {
				method: "POST",
				body: JSON.stringify({
					gameNumber: nextGameNumber,
					team1Side,
					winningTeam,
					picks: {
						TEAM_1: ROLE_ORDER.map((r) => ({
							userId: assign.TEAM_1[r]!,
							role: r,
							championId: picks.TEAM_1[r]!,
						})),
						TEAM_2: ROLE_ORDER.map((r) => ({
							userId: assign.TEAM_2[r]!,
							role: r,
							championId: picks.TEAM_2[r]!,
						})),
					},
					bans: { TEAM_1: bans.TEAM_1.filter(Boolean), TEAM_2: bans.TEAM_2.filter(Boolean) },
				}),
			});
			onRecorded();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	const ChampSlotButton = ({
		championId,
		onClick,
		onClear,
	}: {
		championId: number | undefined;
		onClick: () => void;
		onClear?: () => void;
	}) => {
		const c = championId != null ? champById.get(championId) : undefined;
		return (
			<button
				type="button"
				onClick={onClick}
				className={`btn btn-xs flex-1 min-w-0 gap-1 ${c ? "btn-outline" : "btn-ghost"}`}
			>
				{c ? (
					<>
						<img src={c.iconUrl} alt={c.name} className="w-4 h-4 rounded" />
						<span className="truncate text-[10px]">{c.name}</span>
						{onClear && (
							<span
								className="text-base-content/40 hover:text-error"
								onClick={(e) => {
									e.stopPropagation();
									onClear();
								}}
								role="button"
							>
								✕
							</span>
						)}
					</>
				) : (
					<span className="text-[10px] opacity-60">+ 챔프</span>
				)}
			</button>
		);
	};

	return (
		<>
			<div className="space-y-2 border-t border-base-300 pt-2">
				<h4 className="font-bold text-sm">Game {nextGameNumber} 입력 (라인 자유 배치)</h4>
				<div className="flex items-center gap-3 text-xs">
					<span>1팀 사이드:</span>
					<div className="join">
						<button
							type="button"
							className={`btn btn-xs join-item ${team1Side === "BLUE" ? "btn-info" : "btn-ghost"}`}
							onClick={() => setTeam1Side("BLUE")}
						>
							BLUE
						</button>
						<button
							type="button"
							className={`btn btn-xs join-item ${team1Side === "RED" ? "btn-error" : "btn-ghost"}`}
							onClick={() => setTeam1Side("RED")}
						>
							RED
						</button>
					</div>
				</div>

				{/* BAN — 각 팀 5개 슬롯 */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					{(["TEAM_1", "TEAM_2"] as const).map((team) => (
						<div key={team} className="card bg-base-100 border border-base-300">
							<div className="card-body p-2 gap-1">
								<div className="font-bold text-xs">
									🚫 BAN — {team === "TEAM_1" ? `팀${team1.teamIndex}` : `팀${team2.teamIndex}`}
								</div>
								<div className="grid grid-cols-5 gap-1">
									{[0, 1, 2, 3, 4].map((i) => {
										const banId = bans[team][i];
										return (
											<ChampSlotButton
												key={i}
												championId={banId}
												onClick={() => setPicker({ kind: "ban", team, index: i })}
												{...(banId != null ? { onClear: () => removeBan(team, i) } : {})}
											/>
										);
									})}
								</div>
							</div>
						</div>
					))}
				</div>

				{/* PICK — 라인 5개 × 양 팀, 사용자 + 챔프 */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					{(["TEAM_1", "TEAM_2"] as const).map((team) => {
						const members = team === "TEAM_1" ? team1Members : team2Members;
						return (
							<div key={team} className="card bg-base-100 border border-base-300">
								<div className="card-body p-2 gap-1">
									<div className="font-bold text-xs">
										⚔️ PICK — {team === "TEAM_1" ? `팀${team1.teamIndex}` : `팀${team2.teamIndex}`}
									</div>
									{ROLE_ORDER.map((role) => (
										<div key={role} className="flex items-center gap-1 text-xs">
											<span className="w-8 font-medium">{role.slice(0, 3)}</span>
											<select
												value={assign[team][role] ?? ""}
												onChange={(e) => updateAssign(team, role, e.target.value || undefined)}
												className="select select-bordered select-xs flex-1 min-w-0"
											>
												<option value="">- 선택 -</option>
												{members.map((m) => (
													<option key={m.userId} value={m.userId}>
														{m.displayName}
													</option>
												))}
											</select>
											<ChampSlotButton
												championId={picks[team][role]}
												onClick={() => setPicker({ kind: "pick", team, role })}
											/>
										</div>
									))}
								</div>
							</div>
						);
					})}
				</div>

				<div className="flex items-center gap-3 text-xs">
					<span>승팀:</span>
					<div className="join">
						<button
							type="button"
							className={`btn btn-xs join-item ${winningTeam === "TEAM_1" ? "btn-info" : "btn-ghost"}`}
							onClick={() => setWinningTeam("TEAM_1")}
						>
							팀{team1.teamIndex} 승
						</button>
						<button
							type="button"
							className={`btn btn-xs join-item ${winningTeam === "TEAM_2" ? "btn-error" : "btn-ghost"}`}
							onClick={() => setWinningTeam("TEAM_2")}
						>
							팀{team2.teamIndex} 승
						</button>
					</div>
				</div>
				{error && <div className="alert alert-error alert-sm">{error}</div>}
				<button
					type="button"
					className="btn btn-sm btn-primary w-full"
					onClick={submit}
					disabled={submitting}
				>
					{submitting ? "기록 중…" : `Game ${nextGameNumber} 결과 기록`}
				</button>
			</div>

			<ChampPickerModal
				open={picker !== null}
				champions={champions}
				disabled={usedChampIds}
				onSelect={(c) => {
					if (!picker) return;
					if (picker.kind === "pick") setPick(picker.team, picker.role, c.id);
					else setBan(picker.team, picker.index, c.id);
				}}
				onClose={() => setPicker(null)}
			/>
		</>
	);
}
