import {
	type Assignment,
	LANES,
	type Lane,
	type Participant,
	type Slot,
	type Team,
} from "./types.js";

export function assignmentFromDraft(
	assignments: Record<string, string> | null | undefined,
): Assignment {
	const next: Assignment = new Map();
	if (!assignments) return next;
	for (const [uid, slot] of Object.entries(assignments)) {
		next.set(uid, slot as Slot);
	}
	return next;
}

export function serializeAssignment(assignment: Assignment): string {
	return JSON.stringify(Object.fromEntries(assignment));
}

export function changedAssignmentUids(prev: Assignment, next: Assignment): Set<string> {
	const changed = new Set<string>();
	for (const [uid, slot] of next) {
		if (prev.get(uid) !== slot) changed.add(uid);
	}
	for (const [uid, slot] of prev) {
		if (next.get(uid) !== slot) changed.add(uid);
	}
	return changed;
}

export function activeLanesForTeamSize(teamSize: number): Lane[] {
	return LANES.slice(0, teamSize) as Lane[];
}

export function isAssignmentFilled(assignment: Assignment, activeLanes: readonly Lane[]): boolean {
	if (activeLanes.length === 0) return false;
	const assignedSlots = new Set(assignment.values());
	return activeLanes.every(
		(lane) => assignedSlots.has(`TEAM_1_${lane}`) && assignedSlots.has(`TEAM_2_${lane}`),
	);
}

export function moveUserToSlot(prev: Assignment, userId: string, slot: Slot | null): Assignment {
	const next = new Map(prev);
	if (!slot) {
		next.delete(userId);
		return next;
	}

	for (const [uid, existingSlot] of next) {
		if (existingSlot !== slot || uid === userId) continue;
		const currentSlot = next.get(userId);
		if (currentSlot) next.set(uid, currentSlot);
		else next.delete(uid);
		break;
	}
	next.set(userId, slot);
	return next;
}

export function splitSlot(slot: Slot): { team: Team; role: Lane } {
	const lastUnderscore = slot.lastIndexOf("_");
	return {
		team: slot.slice(0, lastUnderscore) as Team,
		role: slot.slice(lastUnderscore + 1) as Lane,
	};
}

export function swapAssignmentTeams(assignment: Assignment): Assignment {
	const next: Assignment = new Map();
	for (const [uid, slot] of assignment) {
		const { team, role } = splitSlot(slot);
		const flipped: Team = team === "TEAM_1" ? "TEAM_2" : "TEAM_1";
		next.set(uid, `${flipped}_${role}`);
	}
	return next;
}

export function seriesAssignmentsFromDraft(assignment: Assignment) {
	return [...assignment.entries()].map(([userId, slot]) => {
		const { team, role } = splitSlot(slot);
		return { userId, team, role };
	});
}

export function autoAssignByPreference(
	participants: readonly Participant[],
	lanes: readonly Lane[],
) {
	const remaining = [...participants];
	for (let i = remaining.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const ri = remaining[i] as Participant;
		const rj = remaining[j] as Participant;
		remaining[i] = rj;
		remaining[j] = ri;
	}

	const slots: Slot[] = [];
	for (const team of ["TEAM_1", "TEAM_2"] as const) {
		for (const lane of lanes) slots.push(`${team}_${lane}` as Slot);
	}

	const next: Assignment = new Map();
	for (const slot of slots) {
		if (remaining.length === 0) break;
		const { role } = splitSlot(slot);
		let idx = remaining.findIndex((p) => p.roles.includes(role));
		if (idx < 0) idx = remaining.findIndex((p) => p.history.topRole?.role === role);
		if (idx < 0) idx = 0;
		const picked = remaining[idx];
		if (!picked) break;
		next.set(picked.userId, slot);
		remaining.splice(idx, 1);
	}
	return next;
}
