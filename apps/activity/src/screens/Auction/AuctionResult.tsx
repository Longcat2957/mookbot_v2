// 경매내전 종료 화면 — 우승 팀 + 전체 매치 결과 요약.

import { useEffect, useState } from "react";
import { api } from "../../api/rest.js";
import type { AuctionTournamentDetail } from "./types.js";

interface MatchSeriesDetail {
	id: number;
	winningTeam: "TEAM_1" | "TEAM_2" | null;
	games: {
		id: number;
		gameNumber: number;
		winningTeam: "TEAM_1" | "TEAM_2";
		picks: { team: "TEAM_1" | "TEAM_2"; role: string; championName: string }[];
	}[];
}

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
						api<{
							series: { id: number; winningTeam: "TEAM_1" | "TEAM_2" | null };
							games: MatchSeriesDetail["games"];
						}>(`/series/${m.seriesId}`).then((r) => ({
							seriesId: m.seriesId,
							series: {
								id: r.series.id,
								winningTeam: r.series.winningTeam,
								games: r.games,
							} as MatchSeriesDetail,
						})),
					),
				);
				const map: Record<number, MatchSeriesDetail> = {};
				for (const m of matches) map[m.seriesId] = m.series;
				setMatchDetails(map);
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			}
		})();
	}, [tournamentId]);

	if (error) return <div className="alert alert-error">{error}</div>;
	if (!detail) return <div className="alert alert-info">로딩 중…</div>;

	const championTeam = detail.teams.find((t) => t.id === detail.tournament.championTeamId);

	return (
		<section className="space-y-3">
			<header className="flex items-center justify-between">
				<h2 className="text-xl font-bold">🏆 경매내전 #{detail.tournament.id} 종료</h2>
				<button type="button" className="btn btn-sm btn-ghost" onClick={onBack}>
					← 대시보드
				</button>
			</header>

			{/* 우승 팀 카드 */}
			{championTeam && (
				<div className="card bg-success/10 border-2 border-success">
					<div className="card-body p-4 gap-2 text-center">
						<div className="text-4xl">🏆</div>
						<div className="text-lg font-bold">
							우승: 팀{championTeam.teamIndex} {championTeam.captainName}
						</div>
						<div className="text-xs text-base-content/60">
							{championTeam.members.map((m) => m.displayName).join(", ")}
						</div>
					</div>
				</div>
			)}

			{/* 모든 팀 */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				{detail.teams.map((t) => (
					<div
						key={t.id}
						className={`card bg-base-200 ${
							t.id === detail.tournament.championTeamId ? "border-2 border-success" : ""
						}`}
					>
						<div className="card-body p-3 gap-1">
							<div className="font-bold">
								팀{t.teamIndex} · {t.captainName} {t.id === detail.tournament.championTeamId && "🏆"}
							</div>
							<div className="text-sm text-base-content/70">
								{t.members.map((m) => m.displayName).join(" · ")}
							</div>
						</div>
					</div>
				))}
			</div>

			{/* 매치 결과 */}
			<div className="space-y-2">
				<h3 className="font-bold">매치 결과</h3>
				{detail.matches.map((m) => {
					const t1 = detail.teams.find((t) => t.id === m.team1Id);
					const t2 = detail.teams.find((t) => t.id === m.team2Id);
					const md = matchDetails[m.seriesId];
					if (!md) return null;
					const t1Wins = md.games.filter((g) => g.winningTeam === "TEAM_1").length;
					const t2Wins = md.games.filter((g) => g.winningTeam === "TEAM_2").length;
					return (
						<div key={m.seriesId} className="card bg-base-200">
							<div className="card-body p-3 gap-1">
								<div className="flex items-center justify-between flex-wrap gap-2">
									<span className="font-bold">
										{m.round} · {m.format}
									</span>
									<span className="tabular-nums">
										{t1?.captainName} <strong>{t1Wins}</strong> : <strong>{t2Wins}</strong> {t2?.captainName}
									</span>
								</div>
								{md.games.map((g) => (
									<div key={g.id} className="text-xs text-base-content/60">
										Game {g.gameNumber} — {g.winningTeam === "TEAM_1" ? "1팀" : "2팀"} 승
									</div>
								))}
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}
