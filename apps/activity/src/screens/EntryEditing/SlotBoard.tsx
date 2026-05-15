import { PanelCard } from "../../components/DesignPrimitives.js";
import { SlotRow } from "./SlotRow.js";
import { type Slot, TEAM_LABEL } from "./types.js";
import type { UseEntryEditingStateResult } from "./useEntryEditingState.js";

export function SlotBoard({ state }: { state: UseEntryEditingStateResult }) {
	if (!state.detail) return null;
	const { participants } = state.detail;

	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
			{(["TEAM_1", "TEAM_2"] as const).map((team) => (
				<PanelCard key={team} status={team === "TEAM_1" ? "info" : "error"} bodyClassName="p-3 gap-2">
					<h3 className={`card-title text-base ${team === "TEAM_1" ? "text-info" : "text-error"}`}>
						{TEAM_LABEL[team]}
					</h3>
					<div className="space-y-1.5">
						{state.activeLanes.map((lane) => {
							const slot: Slot = `${team}_${lane}`;
							const assignedUserId = [...state.assignment.entries()].find(([, sl]) => sl === slot)?.[0];
							const assignedP = assignedUserId
								? participants.find((p) => p.userId === assignedUserId)
								: null;
							return (
								<SlotRow
									key={slot}
									lane={lane}
									participant={assignedP ?? null}
									onDrop={(uid) => state.moveTo(uid, slot)}
									onClear={() => assignedP && state.moveTo(assignedP.userId, null)}
									onTap={() => state.handleSlotTap(slot, assignedUserId ?? null)}
									selected={state.selectedUid !== null && assignedUserId === state.selectedUid}
									targetHint={state.selectedUid !== null && assignedUserId !== state.selectedUid}
									recentlyChanged={assignedUserId !== undefined && state.recentlyChanged.has(assignedUserId)}
								/>
							);
						})}
					</div>
				</PanelCard>
			))}
		</div>
	);
}
