export function MatchScore({
	t1Wins,
	t2Wins,
	winningTeam,
}: {
	t1Wins: number;
	t2Wins: number;
	winningTeam: "TEAM_1" | "TEAM_2" | null;
}) {
	return (
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
	);
}
