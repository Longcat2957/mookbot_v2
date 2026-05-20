import { winrateTextClass, winrateTextClassDim } from "../../state/winrateColor.js";
import { type LaneMmr, ROLE_LABEL } from "./types.js";

export function LaneMmrCard({ mmr }: { mmr: LaneMmr }) {
	const wrPct = Math.round(mmr.winrate * 100);
	const empty = mmr.mmr === null;
	const radialColor = winrateTextClass(wrPct);

	return (
		<div
			className={`rounded-lg p-3 border min-h-28 ${empty ? "border-base-300 bg-base-200/30 opacity-60" : "border-base-300 bg-base-100"}`}
		>
			<div className="flex items-center justify-between">
				<div className="text-[10px] uppercase tracking-wide text-base-content/60">
					{ROLE_LABEL[mmr.role] ?? mmr.role}
				</div>
				{!empty && mmr.games > 0 && (
					<div
						className={`radial-progress ${radialColor} text-[9px] font-bold tabular-nums`}
						style={
							{
								"--value": wrPct,
								"--size": "1.75rem",
								"--thickness": "2px",
							} as React.CSSProperties
						}
						role="progressbar"
						aria-valuenow={wrPct}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-label={`${ROLE_LABEL[mmr.role] ?? mmr.role} 라인 승률 ${wrPct}%`}
					>
						{wrPct}
					</div>
				)}
			</div>
			{empty ? (
				<div className="text-base-content/40 text-sm mt-1">기록 없음</div>
			) : (
				<>
					<div className="text-2xl font-bold leading-tight tabular-nums mt-0.5">{mmr.mmr}</div>
					<div className="text-xs text-base-content/60 tabular-nums">
						{mmr.games}G · <span className={winrateTextClassDim(wrPct)}>{wrPct}%</span>
					</div>
				</>
			)}
		</div>
	);
}
