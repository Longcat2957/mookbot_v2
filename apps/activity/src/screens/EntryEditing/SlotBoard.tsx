import { cx, PanelCard, StatusBadge } from "../../components/DesignPrimitives.js";
import { SlotRow } from "./SlotRow.js";
import {
	LANE_LABEL,
	type Lane,
	type Slot,
	type SynergyKind,
	type SynergyRecord,
	TEAM_LABEL,
	type Team,
} from "./types.js";
import type { UseEntryEditingStateResult } from "./useEntryEditingState.js";

function oppositeTeam(team: Team): Team {
	return team === "TEAM_1" ? "TEAM_2" : "TEAM_1";
}

function findAssignedUserId(state: UseEntryEditingStateResult, slot: Slot): string | null {
	return [...state.assignment.entries()].find(([, sl]) => sl === slot)?.[0] ?? null;
}

const SYNERGY_ROWS: Array<{
	kind: SynergyKind;
	label: string;
	roleA: Lane;
	roleB: Lane;
	className: string;
}> = [
	{ kind: "TOP_JUNGLE", label: "TOP+JNG", roleA: "TOP", roleB: "JUNGLE", className: "row-start-1" },
	{
		kind: "JUNGLE_MID",
		label: "JNG+MID",
		roleA: "JUNGLE",
		roleB: "MID",
		className: "row-start-2",
	},
	{
		kind: "BOTTOM_SUPPORT",
		label: "BOT+SUP",
		roleA: "BOTTOM",
		roleB: "SUPPORT",
		className: "row-start-4",
	},
];

export function SlotBoard({ state }: { state: UseEntryEditingStateResult }) {
	if (!state.detail) return null;
	const { headToHead = [] } = state.detail;

	return (
		<div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(10.5rem,13rem)_minmax(18rem,1fr)_minmax(18rem,1fr)_minmax(10.5rem,13rem)] 2xl:grid-cols-[minmax(12rem,15rem)_minmax(20rem,1fr)_minmax(20rem,1fr)_minmax(12rem,15rem)]">
			<TeamSynergyPanel state={state} team="TEAM_1" className="order-2 xl:order-1" status="info" />
			<TeamSlotPanel
				state={state}
				team="TEAM_1"
				className="order-1 xl:order-2"
				headToHead={headToHead}
			/>
			<TeamSlotPanel
				state={state}
				team="TEAM_2"
				className="order-3 xl:order-3"
				headToHead={headToHead}
			/>
			<TeamSynergyPanel state={state} team="TEAM_2" className="order-4 xl:order-4" status="error" />
		</div>
	);
}

function TeamSlotPanel({
	state,
	team,
	headToHead,
	className,
}: {
	state: UseEntryEditingStateResult;
	team: Team;
	headToHead: NonNullable<UseEntryEditingStateResult["detail"]>["headToHead"];
	className?: string;
}) {
	if (!state.detail) return null;
	const { participants } = state.detail;
	return (
		<PanelCard
			status={team === "TEAM_1" ? "info" : "error"}
			bodyClassName="p-3 gap-2"
			className={className}
		>
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
					const opponentSlot: Slot = `${oppositeTeam(team)}_${lane}`;
					const opponentUserId = findAssignedUserId(state, opponentSlot);
					const opponent = opponentUserId ? participants.find((p) => p.userId === opponentUserId) : null;
					const h2h =
						assignedUserId && opponentUserId
							? headToHead?.find(
									(h) => h.userId === assignedUserId && h.opponentId === opponentUserId && h.role === lane,
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
	);
}

function TeamSynergyPanel({
	state,
	team,
	status,
	className,
}: {
	state: UseEntryEditingStateResult;
	team: Team;
	status: "info" | "error";
	className?: string;
}) {
	if (!state.detail) return null;
	const { participants, synergies = [] } = state.detail;
	return (
		<PanelCard status={status} bodyClassName="p-3 gap-2" className={className}>
			<h3 className={`card-title text-sm ${status === "info" ? "text-info" : "text-error"}`}>
				{TEAM_LABEL[team]} 시너지
			</h3>
			<div className="grid min-h-[24.875rem] grid-rows-5 gap-1.5">
				{SYNERGY_ROWS.map((row) => {
					const userAId = findAssignedUserId(state, `${team}_${row.roleA}`);
					const userBId = findAssignedUserId(state, `${team}_${row.roleB}`);
					const userA = userAId ? participants.find((p) => p.userId === userAId) : null;
					const userB = userBId ? participants.find((p) => p.userId === userBId) : null;
					const record =
						userAId && userBId
							? synergies.find(
									(s) => s.kind === row.kind && s.userAId === userAId && s.userBId === userBId,
								)
							: undefined;
					return (
						<SynergyCard
							key={row.kind}
							className={row.className}
							label={row.label}
							roleLabel={`${LANE_LABEL[row.roleA]} / ${LANE_LABEL[row.roleB]}`}
							userNames={userA && userB ? `${userA.displayName} / ${userB.displayName}` : "배정 대기"}
							record={record}
						/>
					);
				})}
			</div>
		</PanelCard>
	);
}

function SynergyCard({
	label,
	roleLabel,
	userNames,
	record,
	className,
}: {
	label: string;
	roleLabel: string;
	userNames: string;
	record: SynergyRecord | undefined;
	className?: string;
}) {
	const winrate = record && record.plays > 0 ? Math.round((record.wins / record.plays) * 100) : null;
	const tone =
		record && record.plays > 0 ? (record.wins >= record.losses ? "success" : "error") : "neutral";
	return (
		<div
			className={cx(
				"min-h-[4.75rem] rounded-md border bg-base-300/75 px-2 py-1.5 text-xs",
				tone === "success"
					? "border-success/35"
					: tone === "error"
						? "border-error/35"
						: "border-base-content/10",
				className,
			)}
			title={
				record ? `${label}: ${record.wins}-${record.losses} (${record.plays}G)` : `${label}: 기록 없음`
			}
		>
			<div className="flex items-center justify-between gap-1">
				<span className="font-bold text-base-content">{label}</span>
				<StatusBadge tone={tone} size="xs" variant={tone === "neutral" ? "ghost" : "soft"}>
					{record && record.plays > 0 ? `${record.plays}G` : "없음"}
				</StatusBadge>
			</div>
			<div className="mt-0.5 text-[0.6875rem] text-base-content/45">{roleLabel}</div>
			<div className="mt-1 truncate font-semibold text-base-content/80">{userNames}</div>
			{record && winrate !== null ? (
				<div className="mt-0.5 flex items-center gap-1.5 tabular-nums">
					<span className="font-bold text-base-content">
						{record.wins}-{record.losses}
					</span>
					<span className={cx("font-bold", tone === "success" ? "text-success" : "text-error")}>
						{winrate}%
					</span>
				</div>
			) : (
				<div className="mt-0.5 text-base-content/45">기록 없음</div>
			)}
		</div>
	);
}
