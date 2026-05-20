import { PanelCard } from "../../components/DesignPrimitives.js";
import { SlotRow } from "./SlotRow.js";
import { type Lane, type Slot, TEAM_LABEL, type Team } from "./types.js";
import type { UseEntryEditingStateResult } from "./useEntryEditingState.js";

function oppositeTeam(team: Team): Team {
	return team === "TEAM_1" ? "TEAM_2" : "TEAM_1";
}

function findAssignedUserId(state: UseEntryEditingStateResult, slot: Slot): string | null {
	return [...state.assignment.entries()].find(([, sl]) => sl === slot)?.[0] ?? null;
}

export function SlotBoard({ state }: { state: UseEntryEditingStateResult }) {
	if (!state.detail) return null;
	const { headToHead = [], participants } = state.detail;

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
							const assignedUserId = findAssignedUserId(state, slot);
							const assignedP = assignedUserId
								? participants.find((p) => p.userId === assignedUserId)
								: null;
							const opponentSlot: Slot = `${oppositeTeam(team)}_${lane as Lane}`;
							const opponentUserId = findAssignedUserId(state, opponentSlot);
							const opponent = opponentUserId
								? participants.find((p) => p.userId === opponentUserId)
								: null;
							const h2h =
								assignedUserId && opponentUserId
									? headToHead.find(
											(h) =>
												h.userId === assignedUserId &&
												h.opponentId === opponentUserId &&
												h.role === lane,
										)
									: undefined;
							const h2hProp =
								h2h && opponent
									? {
											headToHead: {
												opponentName: opponent.displayName,
												plays: h2h.plays,
												wins: h2h.wins,
												losses: h2h.losses,
											},
										}
									: {};
							return (
								<SlotRow
									key={slot}
									lane={lane}
									participant={assignedP ?? null}
									{...h2hProp}
									onDrop={(uid) => state.moveTo(uid, slot)}
									onClear={() => assignedP && state.moveTo(assignedP.userId, null)}
									onTap={() => state.handleSlotTap(slot, assignedUserId ?? null)}
									selected={state.selectedUid !== null && assignedUserId === state.selectedUid}
									targetHint={state.selectedUid !== null && assignedUserId !== state.selectedUid}
									recentlyChanged={assignedUserId !== null && state.recentlyChanged.has(assignedUserId)}
								/>
							);
						})}
					</div>
				</PanelCard>
			))}
		</div>
	);
}
