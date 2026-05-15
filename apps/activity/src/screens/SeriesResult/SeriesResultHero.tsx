import { PanelCard } from "../../components/DesignPrimitives.js";
import { scoreByTeam } from "./seriesResultStats.js";
import { type SeriesDetail, teamLabel } from "./types.js";

export function SeriesResultHero({ detail }: { detail: SeriesDetail }) {
	const { team1Wins, team2Wins } = scoreByTeam(detail.games);

	return (
		<PanelCard
			status={detail.series.winningTeam ? "success" : "neutral"}
			bodyClassName="p-5 items-center text-center gap-2"
		>
			{detail.series.winningTeam && (
				<div className="text-3xl text-success leading-none" aria-hidden>
					🏆
				</div>
			)}
			<div className="flex items-end gap-4 tabular-nums">
				<TeamScore
					label="1팀"
					wins={team1Wins}
					won={detail.series.winningTeam === "TEAM_1"}
					color="text-info"
				/>
				<div className="text-3xl opacity-30 leading-none pb-2">:</div>
				<TeamScore
					label="2팀"
					wins={team2Wins}
					won={detail.series.winningTeam === "TEAM_2"}
					color="text-error"
				/>
			</div>
			{detail.series.winningTeam && (
				<div className="text-sm font-bold text-success mt-1">
					{teamLabel(detail.series.winningTeam)} 우승
				</div>
			)}
		</PanelCard>
	);
}

function TeamScore({
	label,
	wins,
	won,
	color,
}: {
	label: string;
	wins: number;
	won: boolean;
	color: string;
}) {
	return (
		<div className="text-center">
			<div className={`text-xs uppercase ${color}`}>{label}</div>
			<div className={`text-3xl font-bold tabular-nums ${won ? "text-success" : ""}`}>{wins}</div>
		</div>
	);
}
