import type { Champion, Team } from "./types.js";

export interface ParseResult {
	matched: (Champion | null)[];
	failed: string[];
}

export interface PreparedBulkChange {
	team: Team;
	kind: "ban" | "pick";
	championIds: (number | null)[];
	failed: string[];
	filledCount: number;
}

export function normalizeChampionQuery(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function matchChampion(token: string, champions: Champion[]): Champion | null {
	const query = normalizeChampionQuery(token);
	if (!query) return null;

	for (const champion of champions) {
		if (normalizeChampionQuery(champion.name) === query) return champion;
		if (normalizeChampionQuery(champion.idSlug) === query) return champion;
	}
	for (const champion of champions) {
		if (normalizeChampionQuery(champion.name).startsWith(query)) return champion;
	}
	for (const champion of champions) {
		if (normalizeChampionQuery(champion.idSlug).startsWith(query)) return champion;
	}
	for (const champion of champions) {
		if (normalizeChampionQuery(champion.name).includes(query)) return champion;
		if (normalizeChampionQuery(champion.idSlug).includes(query)) return champion;
	}
	return null;
}

export function parseAndMatch(input: string, champions: Champion[], maxCount: number): ParseResult {
	const tokens = input.split(",").map((token) => token.trim());
	const matched: (Champion | null)[] = [];
	const failed: string[] = [];

	for (const token of tokens) {
		if (matched.length >= maxCount) break;
		if (token === "") {
			matched.push(null);
			continue;
		}
		const champion = matchChampion(token, champions);
		if (champion) {
			matched.push(champion);
		} else {
			matched.push(null);
			failed.push(token);
		}
	}
	return { matched, failed };
}

export function prepareBulkChange(
	team: Team,
	kind: "ban" | "pick",
	input: string,
	champions: Champion[],
	teamSize: number,
): PreparedBulkChange | null {
	const value = input.trim();
	if (!value) return null;
	const { matched, failed } = parseAndMatch(value, champions, teamSize);
	const championIds = matched.map((champion) => champion?.id ?? null);
	return {
		team,
		kind,
		championIds,
		failed,
		filledCount: championIds.filter((championId) => championId !== null).length,
	};
}

export function teamLabel(team: Team): string {
	return team === "TEAM_1" ? "1팀" : "2팀";
}

export function kindLabel(kind: "ban" | "pick"): string {
	return kind === "pick" ? "픽" : "밴";
}

export function summarizeBulkChange(change: PreparedBulkChange, teamSize: number) {
	return `${teamLabel(change.team)} ${kindLabel(change.kind)} ${change.filledCount}/${teamSize} 적용`;
}

export function summarizeBulkChanges(changes: PreparedBulkChange[], teamSize: number) {
	return changes
		.map(
			(change) =>
				`${teamLabel(change.team)}${kindLabel(change.kind)} ${change.filledCount}/${teamSize}`,
		)
		.join(", ");
}

export function toAppliedChanges(changes: PreparedBulkChange[]) {
	return changes.map((change) => ({
		team: change.team,
		kind: change.kind,
		championIds: change.championIds,
	}));
}
