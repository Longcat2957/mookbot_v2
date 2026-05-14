import { useMemo, useState } from "react";
import { api } from "../../../api/rest.js";
import { ConfirmButton } from "../../../components/ConfirmButton.js";
import { UserAvatar } from "../../../components/UserAvatar.js";
import { useStaleWhileRevalidate } from "../../../state/useStaleWhileRevalidate.js";
import {
	type AuctionMatch,
	type AuctionTournamentDetail,
	type MatchFormat,
	roundLabel,
} from "../types.js";
import type { MatchDetail } from "./_shared.js";
import { GameInputForm } from "./GameInputForm.js";

// ============================================================
// MatchCard — 매치 진행 (게임 결과 입력 / picks-bans)
// ============================================================
export function MatchCard({
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
	const swr = useStaleWhileRevalidate<MatchDetail>(`auction-match:${match.matchId}`, matchFetcher);

	const matchData = swr.data;
	const games = matchData?.games ?? [];
	const completed = matchData?.match.status === "COMPLETED";
	const winningTeam = matchData?.match.winningTeam ?? null;

	const { t1Wins, t2Wins } = useMemo(() => {
		let a = 0;
		let b = 0;
		for (const g of games) {
			if (g.winningTeam === "TEAM_1") a++;
			else if (g.winningTeam === "TEAM_2") b++;
		}
		return { t1Wins: a, t2Wins: b };
	}, [games]);

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
			: "surface-quiet-soft";
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

	return (
		<div className={`card surface-base shadow ${borderClass}`}>
			<div className="card-body p-4 gap-3">
				{/* 헤더 — round + format + status */}
				<div className="flex items-center justify-between flex-wrap gap-2">
					<div className="flex items-center gap-2">
						<span className="text-base font-bold">{roundLabel(match.round, match.bracketIndex)}</span>
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
					<details className="collapse collapse-arrow surface-quiet-soft mt-1">
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
