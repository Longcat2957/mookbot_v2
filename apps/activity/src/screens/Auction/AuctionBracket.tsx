// 경매내전 토너먼트 매치 진행 — BRACKET_SETUP / IN_GAME / COMPLETED.
// 매치 생성 + BO1/BO3 선택 + 라인 자유 픽 + 게임 결과 입력 + 자동 결승.

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api/rest.js";
import { wsClient } from "../../api/ws.js";
import { ConfirmButton } from "../../components/ConfirmButton.js";
import { UserAvatar } from "../../components/UserAvatar.js";
import { usePerms } from "../../state/perms.js";
import { useStaleWhileRevalidate } from "../../state/useStaleWhileRevalidate.js";
import { AuctionSteps } from "./AuctionSteps.js";
import { ChampPickerModal } from "./ChampPickerModal.js";
import type {
	AuctionMatch,
	AuctionTournamentDetail,
	MatchFormat,
	TournamentStatus,
} from "./types.js";
import { useAuctionState } from "./useAuctionState.js";

function statusLabel(s: TournamentStatus): string {
	return {
		CAPTAIN_PICK: "팀장 선출",
		POINT_ALLOC: "포인트 배정",
		BIDDING: "경매 진행",
		PLACEMENT: "배치 완료",
		BRACKET_SETUP: "매치업 구성",
		IN_GAME: "매치 진행 중",
		COMPLETED: "종료",
		CANCELLED: "취소",
	}[s];
}

const ROLE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;
type Role = (typeof ROLE_ORDER)[number];

interface Champion {
	id: number;
	idSlug: string;
	name: string;
	iconUrl: string;
}

interface MatchDetail {
	match: {
		id: number;
		status: string;
		winningTeam: "TEAM_1" | "TEAM_2" | null;
		format: "BO1" | "BO3";
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

	const is20 = s.detail.tournament.format === 20;

	return (
		<section className="space-y-4">
			<header className="flex items-start justify-between flex-wrap gap-3">
				<div className="space-y-1">
					<h2 className="text-2xl font-bold">🎟️ 경매내전 #{s.detail.tournament.id} 토너먼트</h2>
					<p className="text-base text-base-content/70">
						{s.detail.tournament.format}인 · 현재 단계:{" "}
						<strong>{statusLabel(s.detail.tournament.status)}</strong>
					</p>
				</div>
				<div className="flex items-center gap-1">
					<button type="button" className="btn btn-ghost btn-sm" onClick={s.refresh}>
						↻
					</button>
					{/* 토너먼트 강제 취소는 안전을 위해 봇 슬래시 (/경매내전강제삭제) 로 일원화.
					    Activity 에서는 단계 되돌리기 (revertStage) 만 가능 — AuctionDraft 의 [↩ 단계] dropdown 참조. */}
				</div>
			</header>

			<AuctionSteps status={s.detail.tournament.status} />

			{/* BRACKET_SETUP — 운영자가 매치업 구성 */}
			{isSetup && perms.canEdit && <MatchSetup detail={s.detail} onCreate={s.createMatch} />}

			{/* 20인 — 4강 grid + 결승 column (시각적 bracket) */}
			{is20 && (semis.length > 0 || finalOrSingle) && (
				<div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-center">
					{/* 4강 */}
					<div className="space-y-3">
						<h3 className="text-lg font-bold flex items-center gap-2">
							<span className="badge badge-info badge-lg">4강</span>
							<span className="text-base-content/60 text-sm">SEMI</span>
						</h3>
						{semis.length === 0 ? (
							<div className="text-base text-base-content/40 py-4">_(매치업 구성 대기)_</div>
						) : (
							semis.map((m) => (
								<MatchCard
									key={m.matchId}
									match={m}
									detail={s.detail!}
									canEdit={perms.canEdit}
									onTournamentRefresh={s.refresh}
								/>
							))
						)}
					</div>

					{/* 연결선 (lg+ only) */}
					<div className="hidden lg:flex items-center text-4xl text-base-content/30 px-2 select-none">
						→
					</div>

					{/* 결승 */}
					<div className="space-y-3">
						<h3 className="text-lg font-bold flex items-center gap-2">
							<span className="badge badge-warning badge-lg">결승</span>
							<span className="text-base-content/60 text-sm">FINAL</span>
						</h3>
						{finalOrSingle ? (
							<MatchCard
								match={finalOrSingle}
								detail={s.detail}
								canEdit={perms.canEdit}
								onTournamentRefresh={s.refresh}
							/>
						) : perms.canEdit ? (
							<FinalSetup detail={s.detail} semis={semis} onCreate={s.createMatch} />
						) : (
							<div className="text-base text-base-content/40 py-4">_(4강 결과 대기 중)_</div>
						)}
					</div>
				</div>
			)}

			{/* 10인 — 단일 매치 */}
			{!is20 && matches.length > 0 && (
				<div className="space-y-2">
					<h3 className="text-lg font-bold flex items-center gap-2">
						<span className="badge badge-warning badge-lg">매치</span>
					</h3>
					{matches.map((m) => (
						<MatchCard
							key={m.matchId}
							match={m}
							detail={s.detail!}
							canEdit={perms.canEdit}
							onTournamentRefresh={s.refresh}
						/>
					))}
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
	}) => Promise<{ matchId: number }>;
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
			<div className="card bg-base-200 shadow">
				<div className="card-body p-5 gap-3">
					<h3 className="text-lg font-bold">매치 생성</h3>
					<FormatSelect value={format} onChange={setFormat} />
					<div className="text-base">
						<strong>{t1?.captainName}</strong> vs <strong>{t2?.captainName}</strong>
					</div>
					{error && <div className="alert alert-error">{error}</div>}
					<button
						type="button"
						className="btn btn-primary btn-lg"
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
		<div className="card bg-base-200 shadow">
			<div className="card-body p-5 gap-3">
				<h3 className="text-lg font-bold">4강 매치업 구성</h3>
				<p className="text-base text-base-content/60">
					팀 두 개를 선택하면 매치업이 생성됩니다. (남은 팀 {remaining.length}/4)
				</p>
				<FormatSelect value={format} onChange={setFormat} />
				<MatchupBuilder teams={remaining} onPair={createSemi} submitting={submitting} />
				{error && <div className="alert alert-error">{error}</div>}
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
	}) => Promise<{ matchId: number }>;
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
		<div className="card bg-base-200 shadow border-l-4 border-warning">
			<div className="card-body p-5 gap-3">
				<h3 className="text-lg font-bold">결승 생성</h3>
				<FormatSelect value={format} onChange={setFormat} />
				<div className="text-base flex items-center gap-2 flex-wrap">
					{t1 && (
						<UserAvatar
							discordId={t1.captainUserId}
							displayName={t1.captainName}
							imageUrl={t1.captainProfileIconUrl}
							size="sm"
						/>
					)}
					<strong>{t1?.captainName ?? `팀${t1?.teamIndex}`}</strong>
					<span className="text-base-content/40">vs</span>
					{t2 && (
						<UserAvatar
							discordId={t2.captainUserId}
							displayName={t2.captainName}
							imageUrl={t2.captainProfileIconUrl}
							size="sm"
						/>
					)}
					<strong>{t2?.captainName ?? `팀${t2?.teamIndex}`}</strong>
				</div>
				{error && <div className="alert alert-error">{error}</div>}
				<button type="button" className="btn btn-primary btn-lg" onClick={create} disabled={creating}>
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
	const m1Id = semis[0]?.matchId ?? null;
	const m2Id = semis[1]?.matchId ?? null;

	const m1Fetcher = useCallback(
		() =>
			m1Id !== null
				? api<MatchDetail>(`/auction-matches/${m1Id}`)
				: Promise.reject(new Error("no semi 1")),
		[m1Id],
	);
	const m2Fetcher = useCallback(
		() =>
			m2Id !== null
				? api<MatchDetail>(`/auction-matches/${m2Id}`)
				: Promise.reject(new Error("no semi 2")),
		[m2Id],
	);
	const m1Swr = useStaleWhileRevalidate<MatchDetail>(m1Id, m1Fetcher, {
		enabled: m1Id !== null,
	});
	const m2Swr = useStaleWhileRevalidate<MatchDetail>(m2Id, m2Fetcher, {
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
		m1Swr.data.match.status !== "COMPLETED" ||
		m2Swr.data.match.status !== "COMPLETED" ||
		!m1Swr.data.match.winningTeam ||
		!m2Swr.data.match.winningTeam
	) {
		return null;
	}
	const w1 = m1Swr.data.match.winningTeam === "TEAM_1" ? semis[0]!.team1Id : semis[0]!.team2Id;
	const w2 = m2Swr.data.match.winningTeam === "TEAM_1" ? semis[1]!.team1Id : semis[1]!.team2Id;
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
				className={`btn join-item ${value === "BO1" ? "btn-primary" : "btn-ghost"}`}
				onClick={() => onChange("BO1")}
			>
				BO1
			</button>
			<button
				type="button"
				className={`btn join-item ${value === "BO3" ? "btn-primary" : "btn-ghost"}`}
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
		<div className="space-y-3">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
				{teams.map((t) => {
					const isT1 = t1 === t.id;
					const isT2 = t2 === t.id;
					return (
						<button
							key={t.id}
							type="button"
							onClick={() => {
								if (t1 === t.id) setT1(null);
								else if (t2 === t.id) setT2(null);
								else if (t1 === null) setT1(t.id);
								else if (t2 === null) setT2(t.id);
							}}
							className={`flex items-center gap-2.5 p-2.5 rounded-md border-2 transition text-left ${
								isT1
									? "border-info bg-info/10"
									: isT2
										? "border-error bg-error/10"
										: "border-base-300 bg-base-100 hover:bg-base-300/40"
							}`}
						>
							<UserAvatar
								discordId={t.captainUserId}
								displayName={t.captainName}
								imageUrl={t.captainProfileIconUrl}
								size="sm"
							/>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-1.5">
									<div className="badge badge-info badge-sm">팀{t.teamIndex}</div>
									{isT1 && <span className="badge badge-info badge-sm">1번</span>}
									{isT2 && <span className="badge badge-error badge-sm">2번</span>}
								</div>
								<div className="font-bold text-base truncate">{t.captainName}</div>
							</div>
						</button>
					);
				})}
			</div>
			<button
				type="button"
				className="btn btn-primary btn-lg w-full"
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
	onTournamentRefresh,
}: {
	match: AuctionMatch;
	detail: AuctionTournamentDetail;
	canEdit: boolean;
	onTournamentRefresh: () => void;
}) {
	const t1 = detail.teams.find((t) => t.id === match.team1Id);
	const t2 = detail.teams.find((t) => t.id === match.team2Id);
	const [expanded, setExpanded] = useState(false);

	const matchFetcher = useMemo(
		() => () => api<MatchDetail>(`/auction-matches/${match.matchId}`),
		[match.matchId],
	);
	const swr = useStaleWhileRevalidate<MatchDetail>(
		`auction-match:${match.matchId}`,
		matchFetcher,
	);

	const matchData = swr.data;
	const games = matchData?.games ?? [];
	const completed = matchData?.match.status === "COMPLETED";
	const winningTeam = matchData?.match.winningTeam ?? null;

	const t1Wins = games.filter((g) => g.winningTeam === "TEAM_1").length;
	const t2Wins = games.filter((g) => g.winningTeam === "TEAM_2").length;

	const inProgress = !completed && games.length > 0;
	const borderClass = completed
		? "border-2 border-success"
		: inProgress
			? "border-2 border-warning"
			: "border border-base-300";

	const TeamRow = ({
		team,
		isTop,
		teamSide,
	}: {
		team: AuctionTournamentDetail["teams"][number] | undefined;
		isTop: boolean;
		teamSide: "TEAM_1" | "TEAM_2";
	}) => {
		if (!team) return null;
		const isWinner = completed && winningTeam === teamSide;
		const isTeam1 = teamSide === "TEAM_1";
		const winnerBg = isWinner
			? isTeam1
				? "bg-info/10 ring-1 ring-info"
				: "bg-error/10 ring-1 ring-error"
			: "bg-base-100/40";
		const badgeColor = isTeam1 ? "badge-info" : "badge-error";
		return (
			<div className={`p-2.5 rounded-md ${winnerBg} ${!isTop ? "mt-0" : ""}`}>
				<div className="flex items-center gap-2">
					<div className={`badge ${badgeColor} badge-lg`}>팀{team.teamIndex}</div>
					<UserAvatar
						discordId={team.captainUserId}
						displayName={team.captainName}
						imageUrl={team.captainProfileIconUrl}
						size="sm"
					/>
					<div className="flex-1 min-w-0">
						<div className="font-bold text-base truncate flex items-center gap-1">
							<span className="badge badge-warning badge-xs">👑</span>
							{team.captainName}
						</div>
					</div>
					{isWinner && <span className="text-2xl">🏆</span>}
				</div>
				{/* 팀원 5명 avatar row */}
				<div className="flex items-center gap-1 mt-2 flex-wrap">
					{team.members.map((m) => (
						<div key={m.userId} className="flex items-center gap-1 text-sm">
							<UserAvatar
								discordId={m.userId}
								displayName={m.displayName}
								imageUrl={m.profileIconUrl}
								size="xs"
							/>
							<span
								className={`truncate max-w-[6rem] ${m.userId === team.captainUserId ? "font-medium" : ""}`}
							>
								{m.displayName}
							</span>
						</div>
					))}
				</div>
			</div>
		);
	};

	const roundLabel =
		match.round === "FINAL"
			? "결승"
			: match.round === "SEMI"
				? `4강 #${match.bracketIndex ?? ""}`
				: "매치";

	return (
		<div className={`card bg-base-200 shadow ${borderClass}`}>
			<div className="card-body p-4 gap-3">
				{/* 헤더 — round + format + status */}
				<div className="flex items-center justify-between flex-wrap gap-2">
					<div className="flex items-center gap-2">
						<span className="text-base font-bold">{roundLabel}</span>
						<span className="badge badge-ghost">{match.format}</span>
						{inProgress && (
							<span className="badge badge-warning gap-1.5">
								<span className="inline-block size-2 rounded-full bg-warning-content animate-pulse" />
								진행 중
							</span>
						)}
						{completed && (
							<span className="badge badge-success">
								🏆 팀{winningTeam === "TEAM_1" ? t1?.teamIndex : t2?.teamIndex} 승
							</span>
						)}
					</div>
				</div>

				{/* TEAM_1 (위) — 큰 스코어 — TEAM_2 (아래) */}
				<TeamRow team={t1} isTop teamSide="TEAM_1" />

				<div className="flex items-center justify-center gap-4 py-1 tabular-nums">
					<span
						className={`text-5xl font-bold ${winningTeam === "TEAM_1" ? "text-info" : "text-base-content/70"}`}
					>
						{t1Wins}
					</span>
					<span className="text-3xl opacity-30">:</span>
					<span
						className={`text-5xl font-bold ${winningTeam === "TEAM_2" ? "text-error" : "text-base-content/70"}`}
					>
						{t2Wins}
					</span>
				</div>

				<TeamRow team={t2} isTop={false} teamSide="TEAM_2" />

				{canEdit && !completed && (
					<div className="flex gap-1.5 flex-wrap">
						<button
							type="button"
							className="btn btn-primary flex-1"
							onClick={() => setExpanded((v) => !v)}
						>
							{expanded ? "접기" : `Game ${games.length + 1} 입력`}
						</button>
						{games.length === 0 && (
							<MatchFormatToggle
								matchId={match.matchId}
								format={match.format}
								onChanged={() => {
									swr.refresh();
									onTournamentRefresh();
								}}
							/>
						)}
						{games.length > 0 && (
							<ConfirmButton
								label="↺ 직전 게임"
								onConfirm={async () => {
									await api(`/auction-matches/${match.matchId}/games/last`, {
										method: "DELETE",
									});
									swr.refresh();
									onTournamentRefresh();
								}}
								variant="error"
								className="btn"
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
						<summary className="collapse-title text-sm py-1.5 min-h-0">
							게임 기록 ({games.length})
						</summary>
						<div className="collapse-content text-sm">
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
	matchId,
	format,
	onChanged,
}: {
	matchId: number;
	format: MatchFormat;
	onChanged: () => void;
}) {
	const [submitting, setSubmitting] = useState(false);
	const toggle = async () => {
		setSubmitting(true);
		try {
			await api(`/auction-matches/${matchId}/format`, {
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
	games: MatchDetail["games"];
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
			await api(`/auction-matches/${match.matchId}/games`, {
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
								tabIndex={0}
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
