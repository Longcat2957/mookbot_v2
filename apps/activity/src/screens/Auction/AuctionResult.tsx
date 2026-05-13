// 경매내전 종료 화면 — 우승 팀 hero + bracket 결과 + 전체 매치 요약.

import { useEffect, useState } from "react";
import { api } from "../../api/rest.js";
import { UserAvatar } from "../../components/UserAvatar.js";
import { AuctionSteps } from "./AuctionSteps.js";
import type { AuctionTournamentDetail } from "./types.js";

interface MatchSeriesDetail {
	id: number;
	winningTeam: "TEAM_1" | "TEAM_2" | null;
	games: {
		id: number;
		gameNumber: number;
		winningTeam: "TEAM_1" | "TEAM_2";
		team1Side?: "BLUE" | "RED";
		picks: { team: "TEAM_1" | "TEAM_2"; role: string; championName: string }[];
		bans?: { team: "TEAM_1" | "TEAM_2"; position: number; championName: string }[];
	}[];
}

interface AuctionMatchDetailResponse {
	match: {
		id: number;
		status: string;
		winningTeam: "TEAM_1" | "TEAM_2" | null;
	};
	games: MatchSeriesDetail["games"];
}

const ROLE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;

export function AuctionResult({
	tournamentId,
	onBack,
}: {
	tournamentId: number | null;
	onBack: () => void;
}) {
	const [detail, setDetail] = useState<AuctionTournamentDetail | null>(null);
	const [matchDetails, setMatchDetails] = useState<Record<number, MatchSeriesDetail>>({});
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (tournamentId === null) return;
		(async () => {
			try {
				const d = await api<AuctionTournamentDetail>(`/auction-tournaments/${tournamentId}`);
				setDetail(d);
				const matches = await Promise.all(
					d.matches.map((m) =>
						api<AuctionMatchDetailResponse>(`/auction-matches/${m.matchId}`).then((r) => ({
							matchId: m.matchId,
							series: {
								id: r.match.id,
								winningTeam: r.match.winningTeam,
								games: r.games,
							} as MatchSeriesDetail,
						})),
					),
				);
				const map: Record<number, MatchSeriesDetail> = {};
				for (const m of matches) map[m.matchId] = m.series;
				setMatchDetails(map);
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			}
		})();
	}, [tournamentId]);

	if (error) return <div className="alert alert-error">{error}</div>;
	if (!detail) return <div className="alert alert-info">로딩 중…</div>;

	const championTeam = detail.teams.find((t) => t.id === detail.tournament.championTeamId);
	const finalMatch = detail.matches.find((m) => m.round === "FINAL" || m.round === "SINGLE");
	const finalMd = finalMatch ? matchDetails[finalMatch.matchId] : undefined;
	const finalT1Wins = finalMd ? finalMd.games.filter((g) => g.winningTeam === "TEAM_1").length : 0;
	const finalT2Wins = finalMd ? finalMd.games.filter((g) => g.winningTeam === "TEAM_2").length : 0;
	const finalScoreText =
		finalMatch && finalMd
			? `${finalMatch.format} 결승: ${Math.max(finalT1Wins, finalT2Wins)}-${Math.min(finalT1Wins, finalT2Wins)}`
			: null;

	// 준우승 = 결승에서 패한 팀
	const runnerUpTeamId =
		finalMatch && finalMd && finalMd.winningTeam
			? finalMd.winningTeam === "TEAM_1"
				? finalMatch.team2Id
				: finalMatch.team1Id
			: null;

	const semis = detail.matches.filter((m) => m.round === "SEMI");
	const is20 = detail.tournament.format === 20;

	return (
		<section className="space-y-4">
			<header className="flex items-center justify-between flex-wrap gap-3">
				<h2 className="text-2xl font-bold">🏆 경매내전 #{detail.tournament.id} 종료</h2>
				<button type="button" className="btn btn-ghost" onClick={onBack}>
					← 대시보드
				</button>
			</header>

			<AuctionSteps status={detail.tournament.status} />

			{/* 우승 팀 — trophy hero */}
			{championTeam && (
				<div className="card bg-success/10 border-2 border-success shadow-lg">
					<div className="card-body p-6 gap-3 text-center">
						<div className="text-6xl select-none">🏆</div>
						<div className="text-2xl font-bold">
							우승 · 팀{championTeam.teamIndex} {championTeam.captainName}
						</div>
						{finalScoreText && <div className="text-base text-base-content/60">{finalScoreText}</div>}
						{/* 멤버 5명 avatar xl row */}
						<div className="flex items-end justify-center gap-3 flex-wrap pt-2">
							{championTeam.members.map((m) => (
								<div key={m.userId} className="flex flex-col items-center gap-1.5">
									<div
										className={
											m.userId === championTeam.captainUserId ? "ring-2 ring-warning rounded-full" : ""
										}
									>
										<UserAvatar
											discordId={m.userId}
											displayName={m.displayName}
											imageUrl={m.profileIconUrl}
											size="lg"
										/>
									</div>
									<div className="text-sm font-medium max-w-[6rem] truncate">
										{m.displayName}
										{m.userId === championTeam.captainUserId && " 👑"}
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			)}

			{/* Bracket 결과 (20인) */}
			{is20 && semis.length > 0 && finalMatch && (
				<div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-3 items-center">
					<div className="space-y-3">
						<h3 className="text-lg font-bold flex items-center gap-2">
							<span className="badge badge-info badge-lg">4강</span>
						</h3>
						{semis.map((m) => (
							<ResultMatchCard key={m.matchId} match={m} detail={detail} md={matchDetails[m.matchId]} />
						))}
					</div>
					<div className="hidden lg:flex items-center text-4xl text-base-content/30 px-2 select-none">
						→
					</div>
					<div>
						<h3 className="text-lg font-bold flex items-center gap-2 mb-3">
							<span className="badge badge-warning badge-lg">결승</span>
						</h3>
						<ResultMatchCard match={finalMatch} detail={detail} md={matchDetails[finalMatch.matchId]} />
					</div>
				</div>
			)}

			{/* 10인 — 단일 매치 */}
			{!is20 && finalMatch && (
				<div className="space-y-2">
					<h3 className="text-lg font-bold flex items-center gap-2">
						<span className="badge badge-warning badge-lg">매치</span>
					</h3>
					<ResultMatchCard match={finalMatch} detail={detail} md={matchDetails[finalMatch.matchId]} />
				</div>
			)}

			{/* 모든 팀 비교 */}
			<div className="space-y-2">
				<h3 className="text-lg font-bold">전체 팀</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					{detail.teams.map((t) => {
						const isChamp = t.id === detail.tournament.championTeamId;
						const isRunnerUp = t.id === runnerUpTeamId;
						const borderColor = isChamp
							? "border-2 border-success"
							: isRunnerUp
								? "border-2 border-info"
								: "border border-base-300";
						return (
							<div key={t.id} className={`card bg-base-200 shadow-sm ${borderColor}`}>
								<div className="card-body p-4 gap-2">
									<div className="flex items-center gap-2 flex-wrap">
										<div className="badge badge-info badge-lg">팀{t.teamIndex}</div>
										<span className="badge badge-warning badge-sm">👑</span>
										<span className="font-bold text-base truncate">{t.captainName}</span>
										{isChamp && <span className="badge badge-success ml-auto">🏆 우승</span>}
										{isRunnerUp && <span className="badge badge-info ml-auto">🥈 준우승</span>}
									</div>
									<div className="flex flex-wrap gap-2">
										{t.members.map((m) => (
											<div key={m.userId} className="flex items-center gap-1.5 text-sm">
												<UserAvatar
													discordId={m.userId}
													displayName={m.displayName}
													imageUrl={m.profileIconUrl}
													size="xs"
												/>
												<span className="max-w-[6rem] truncate">{m.displayName}</span>
											</div>
										))}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* 게임별 픽/밴 — collapse */}
			<div className="space-y-2">
				<h3 className="text-lg font-bold">게임별 픽/밴</h3>
				{detail.matches.map((m) => {
					const t1 = detail.teams.find((t) => t.id === m.team1Id);
					const t2 = detail.teams.find((t) => t.id === m.team2Id);
					const md = matchDetails[m.matchId];
					if (!md) return null;
					const t1Wins = md.games.filter((g) => g.winningTeam === "TEAM_1").length;
					const t2Wins = md.games.filter((g) => g.winningTeam === "TEAM_2").length;
					const roundLabel =
						m.round === "FINAL" ? "결승" : m.round === "SEMI" ? `4강 #${m.bracketIndex ?? ""}` : "매치";
					return (
						<div key={m.matchId} className="card bg-base-200 shadow-sm">
							<div className="card-body p-4 gap-2">
								<div className="flex items-center justify-between flex-wrap gap-2">
									<span className="text-base font-bold">
										{roundLabel} <span className="badge badge-ghost">{m.format}</span>
									</span>
									<span className="tabular-nums text-base">
										{t1?.captainName} <strong>{t1Wins}</strong> : <strong>{t2Wins}</strong> {t2?.captainName}
									</span>
								</div>
								{md.games.map((g) => {
									const picksByTeamRole = new Map<string, string>();
									for (const p of g.picks) picksByTeamRole.set(`${p.team}_${p.role}`, p.championName);
									return (
										<details key={g.id} className="collapse collapse-arrow bg-base-100/40 mt-1">
											<summary className="collapse-title text-sm min-h-0 py-2">
												Game {g.gameNumber} — {g.winningTeam === "TEAM_1" ? "1팀" : "2팀"} 승
												{g.team1Side && ` · 1팀 ${g.team1Side}`}
											</summary>
											<div className="collapse-content text-sm px-4 pb-3">
												<div className="grid grid-cols-2 gap-3 mt-1">
													{(["TEAM_1", "TEAM_2"] as const).map((team) => (
														<div key={team}>
															<div className="font-bold mb-1 text-base-content/70">
																{team === "TEAM_1" ? "1팀" : "2팀"} 픽
															</div>
															{ROLE_ORDER.map((r) => (
																<div key={r} className="flex gap-1.5">
																	<span className="w-10 text-base-content/50">{r.slice(0, 3)}</span>
																	<span>{picksByTeamRole.get(`${team}_${r}`) ?? "-"}</span>
																</div>
															))}
														</div>
													))}
												</div>
												{g.bans && g.bans.length > 0 && (
													<div className="mt-2">
														<div className="font-bold text-base-content/70">BAN</div>
														<div className="text-base-content/60">
															1팀:{" "}
															{g.bans
																.filter((b) => b.team === "TEAM_1")
																.map((b) => b.championName)
																.join(", ") || "-"}
															{" / "}
															2팀:{" "}
															{g.bans
																.filter((b) => b.team === "TEAM_2")
																.map((b) => b.championName)
																.join(", ") || "-"}
														</div>
													</div>
												)}
											</div>
										</details>
									);
								})}
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}

// ============================================================
// ResultMatchCard — bracket 결과 매치 카드 (간소화 버전, 픽밴은 별도 collapse)
// ============================================================
function ResultMatchCard({
	match,
	detail,
	md,
}: {
	match: AuctionTournamentDetail["matches"][number];
	detail: AuctionTournamentDetail;
	md: MatchSeriesDetail | undefined;
}) {
	const t1 = detail.teams.find((t) => t.id === match.team1Id);
	const t2 = detail.teams.find((t) => t.id === match.team2Id);
	if (!md || !t1 || !t2) return null;
	const t1Wins = md.games.filter((g) => g.winningTeam === "TEAM_1").length;
	const t2Wins = md.games.filter((g) => g.winningTeam === "TEAM_2").length;
	const winningTeam = md.winningTeam;

	const TeamLine = ({
		team,
		teamSide,
	}: {
		team: AuctionTournamentDetail["teams"][number];
		teamSide: "TEAM_1" | "TEAM_2";
	}) => {
		const isWinner = winningTeam === teamSide;
		const isTeam1 = teamSide === "TEAM_1";
		const winnerBg = isWinner
			? isTeam1
				? "bg-info/10 ring-1 ring-info"
				: "bg-error/10 ring-1 ring-error"
			: "bg-base-100/40";
		const badgeColor = isTeam1 ? "badge-info" : "badge-error";
		return (
			<div className={`p-2.5 rounded-md ${winnerBg}`}>
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
				<div className="flex items-center gap-1 mt-2 flex-wrap">
					{team.members.map((m) => (
						<div key={m.userId} className="flex items-center gap-1 text-sm">
							<UserAvatar
								discordId={m.userId}
								displayName={m.displayName}
								imageUrl={m.profileIconUrl}
								size="xs"
							/>
							<span className="truncate max-w-[6rem]">{m.displayName}</span>
						</div>
					))}
				</div>
			</div>
		);
	};

	return (
		<div className="card bg-base-200 shadow border-2 border-success">
			<div className="card-body p-4 gap-3">
				<TeamLine team={t1} teamSide="TEAM_1" />
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
				<TeamLine team={t2} teamSide="TEAM_2" />
			</div>
		</div>
	);
}
