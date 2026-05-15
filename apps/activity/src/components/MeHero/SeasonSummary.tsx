import { winrateTextClassDim } from "../../state/winrateColor.js";
import type { MeProfileResponse } from "./types.js";

export function SeasonSummary({
	season,
	totals,
}: {
	season: MeProfileResponse["season"];
	totals: MeProfileResponse["totals"];
}) {
	const wrPct = totals.games > 0 ? Math.round(totals.winrate * 100) : null;
	const wrColor = wrPct === null ? "text-base-content/50" : winrateTextClassDim(wrPct);

	return (
		<div className="text-right text-xs shrink-0">
			<div className="text-base-content/50">시즌</div>
			<div className="font-medium">{season.name || `S${season.id}`}</div>
			{totals.games > 0 ? (
				<div className="mt-2 tabular-nums">
					<span className="text-info font-bold">{totals.wins}</span>
					<span className="opacity-30 mx-0.5">·</span>
					<span className="text-error font-bold">{totals.losses}</span>
					<span className={`ml-1.5 font-bold ${wrColor}`}>{wrPct}%</span>
				</div>
			) : (
				<div className="mt-2 text-base-content/40">기록 없음</div>
			)}
		</div>
	);
}
