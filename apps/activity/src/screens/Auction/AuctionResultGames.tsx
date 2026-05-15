import { type MatchSeriesDetail, ROLE_ORDER } from "./resultTypes.js";
import { type AuctionTournamentDetail, roundLabel } from "./types.js";

export function AuctionResultGames({
	detail,
	matchDetails,
}: {
	detail: AuctionTournamentDetail;
	matchDetails: Record<number, MatchSeriesDetail>;
}) {
	return (
		<div className="space-y-2">
			<h3 className="text-lg font-bold">게임별 픽/밴</h3>
			{detail.matches.map((m) => {
				const t1 = detail.teams.find((t) => t.id === m.team1Id);
				const t2 = detail.teams.find((t) => t.id === m.team2Id);
				const md = matchDetails[m.matchId];
				if (!md) return null;
				const t1Wins = md.games.filter((g) => g.winningTeam === "TEAM_1").length;
				const t2Wins = md.games.filter((g) => g.winningTeam === "TEAM_2").length;
				return (
					<div key={m.matchId} className="card surface-base shadow-sm">
						<div className="card-body p-4 gap-2">
							<div className="flex items-center justify-between flex-wrap gap-2">
								<span className="text-base font-bold">
									{roundLabel(m.round, m.bracketIndex)} <span className="badge badge-ghost">{m.format}</span>
								</span>
								<span className="tabular-nums text-base">
									{t1?.captainName} <strong>{t1Wins}</strong> : <strong>{t2Wins}</strong> {t2?.captainName}
								</span>
							</div>
							{md.games.map((g) => (
								<GamePickBan key={g.id} game={g} />
							))}
						</div>
					</div>
				);
			})}
		</div>
	);
}

function GamePickBan({ game }: { game: MatchSeriesDetail["games"][number] }) {
	const picksByTeamRole = new Map<string, string>();
	for (const p of game.picks) picksByTeamRole.set(`${p.team}_${p.role}`, p.championName);

	return (
		<details className="collapse collapse-arrow surface-quiet-soft mt-1">
			<summary className="collapse-title text-sm min-h-0 py-2">
				Game {game.gameNumber} — {game.winningTeam === "TEAM_1" ? "1팀" : "2팀"} 승
				{game.team1Side && ` · 1팀 ${game.team1Side}`}
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
				{game.bans && game.bans.length > 0 && (
					<div className="mt-2">
						<div className="font-bold text-base-content/70">BAN</div>
						<div className="text-base-content/60">
							1팀:{" "}
							{game.bans
								.filter((b) => b.team === "TEAM_1")
								.map((b) => b.championName)
								.join(", ") || "-"}
							{" / "}
							2팀:{" "}
							{game.bans
								.filter((b) => b.team === "TEAM_2")
								.map((b) => b.championName)
								.join(", ") || "-"}
						</div>
					</div>
				)}
			</div>
		</details>
	);
}
