import { winrateTextClassDim } from "../../state/winrateColor.js";
import { type LaneMmr, ROLE_LABEL } from "./types.js";

export function LaneMmrGrid({ laneMmrs }: { laneMmrs: LaneMmr[] }) {
	return (
		<div className="grid grid-cols-5 gap-1 sm:gap-1.5">
			{laneMmrs.map((lane) => (
				<LaneMmrCell key={lane.role} lane={lane} />
			))}
		</div>
	);
}

function LaneMmrCell({ lane }: { lane: LaneMmr }) {
	const empty = lane.mmr === null;
	const lanePct = !empty && lane.games > 0 ? Math.round(lane.winrate * 100) : null;
	const laneWrColor = lanePct === null ? "text-base-content/40" : winrateTextClassDim(lanePct);

	return (
		<div
			className={`rounded-md p-1 sm:p-1.5 text-center ${empty ? "bg-base-100/30" : "surface-quiet"}`}
		>
			<div className="text-[9px] uppercase tracking-wide text-base-content/60">
				{ROLE_LABEL[lane.role] ?? lane.role}
			</div>
			<div
				className={`text-base sm:text-lg font-bold tabular-nums leading-none mt-0.5 ${empty ? "text-base-content/30" : ""}`}
			>
				{lane.mmr ?? "—"}
			</div>
			<div className="text-[9px] tabular-nums leading-tight mt-0.5 whitespace-nowrap">
				{empty ? (
					<span className="text-base-content/30">—</span>
				) : (
					<>
						<span className="text-base-content/50">{lane.games}G</span>
						{lanePct !== null && <span className={`ml-1 font-medium ${laneWrColor}`}>{lanePct}%</span>}
					</>
				)}
			</div>
		</div>
	);
}
