import { useMemo } from "react";
import { SlotTile } from "./SlotTile.js";
import {
	type Champion,
	type GameDraft,
	LANE_LABEL,
	LANE_ORDER,
	type Side,
	type Team,
} from "./types.js";

export function TeamColumn({
	team,
	side,
	teamSize,
	draft,
	lineup,
	champions,
	activeSlot,
	onSlotClick,
}: {
	team: Team;
	side: Side;
	teamSize: number;
	draft: GameDraft;
	lineup: Map<string, string>;
	champions: Champion[];
	activeSlot: { kind: "ban" | "pick"; team: Team; idx: number } | null;
	onSlotClick: (team: Team, kind: "ban" | "pick", idx: number) => void;
}) {
	const teamLabel = team === "TEAM_1" ? "1팀" : "2팀";
	const champById = useMemo(() => {
		const m = new Map<number, Champion>();
		for (const c of champions) m.set(c.id, c);
		return m;
	}, [champions]);

	const headerColor = side === "BLUE" ? "text-info" : "text-error";
	const borderColor = side === "BLUE" ? "border-info" : "border-error";
	const lanes = LANE_ORDER.slice(0, teamSize);

	return (
		<div className={`card surface-base shadow-sm border-l-4 ${borderColor}`}>
			<div className="card-body p-3 gap-2">
				<div className="flex items-center justify-between">
					<h3 className={`card-title text-base ${headerColor}`}>{teamLabel}</h3>
					<span className={`badge ${side === "BLUE" ? "badge-info" : "badge-error"}`}>{side}</span>
				</div>

				<div className="bg-warning/5 rounded-md p-2 -mx-1">
					<div className="text-xs text-warning/80 mb-1 uppercase tracking-wide font-bold flex items-center gap-1">
						<span>🚫</span> 밴 ({draft.bans[team].filter(Boolean).length}/{teamSize})
					</div>
					<div className="flex gap-1 flex-wrap">
						{draft.bans[team].map((cid, i) => (
							<SlotTile
								key={`b${i}`}
								size="md"
								champion={cid !== null ? (champById.get(cid) ?? null) : null}
								active={activeSlot?.kind === "ban" && activeSlot.team === team && activeSlot.idx === i}
								onClick={() => onSlotClick(team, "ban", i)}
								banned
							/>
						))}
					</div>
				</div>

				<div className="bg-success/5 rounded-md p-2 -mx-1">
					<div className="text-xs text-success/80 mb-1 uppercase tracking-wide font-bold flex items-center gap-1">
						<span>⚔️</span> 픽 ({draft.picks[team].filter(Boolean).length}/{teamSize})
					</div>
					<div className="space-y-1">
						{lanes.map((lane, i) => {
							const cid = draft.picks[team][i] ?? null;
							const player = lineup.get(`${team}_${lane}`) ?? "—";
							return (
								<div key={lane} className="flex items-center gap-2 bg-base-300/40 rounded-md p-1.5">
									<SlotTile
										size="lg"
										champion={cid !== null ? (champById.get(cid) ?? null) : null}
										active={activeSlot?.kind === "pick" && activeSlot.team === team && activeSlot.idx === i}
										onClick={() => onSlotClick(team, "pick", i)}
									/>
									<div className="flex-1 min-w-0 leading-tight">
										<div className="text-[10px] text-base-content/60">{LANE_LABEL[lane]}</div>
										<div className="text-sm font-semibold truncate">{player}</div>
										{cid !== null && (
											<div className="text-xs text-base-content/70 truncate">
												{champById.get(cid)?.name ?? ""}
											</div>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
