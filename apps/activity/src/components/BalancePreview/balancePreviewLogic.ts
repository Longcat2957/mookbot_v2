import { type BalanceParticipant, LANE_ORDER } from "./types.js";

export function buildBalanceSummary(participants: BalanceParticipant[]) {
	const byTeamLane = new Map<string, BalanceParticipant>();
	for (const participant of participants)
		byTeamLane.set(`${participant.team}_${participant.role}`, participant);
	const activeLanes = LANE_ORDER.filter(
		(lane) => byTeamLane.has(`TEAM_1_${lane}`) && byTeamLane.has(`TEAM_2_${lane}`),
	);
	const t1Sum = activeLanes.reduce(
		(acc, lane) => acc + (byTeamLane.get(`TEAM_1_${lane}`)?.laneMmr ?? 0),
		0,
	);
	const t2Sum = activeLanes.reduce(
		(acc, lane) => acc + (byTeamLane.get(`TEAM_2_${lane}`)?.laneMmr ?? 0),
		0,
	);
	const size = Math.max(1, activeLanes.length);
	return {
		byTeamLane,
		activeLanes,
		t1Avg: Math.round(t1Sum / size),
		t2Avg: Math.round(t2Sum / size),
	};
}

export function sideTheme(side: "BLUE" | "RED") {
	return side === "BLUE"
		? { text: "text-info", border: "border-info", badge: "badge-info" }
		: { text: "text-error", border: "border-error", badge: "badge-error" };
}
