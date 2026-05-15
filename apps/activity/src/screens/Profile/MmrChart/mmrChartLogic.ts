import type { ChartRow, HistoryPoint, Role } from "./types.js";

export function normalizeMmrRows(points: HistoryPoint[]): ChartRow[] {
	const out: ChartRow[] = [];
	const lastValue: Partial<Record<Role, number>> = {};
	const sorted = [...points].sort((a, b) => a.createdAt - b.createdAt);
	for (const point of sorted) {
		lastValue[point.role] = point.mmrAfter;
		const last = out[out.length - 1];
		if (last && last.createdAt === point.createdAt) {
			last[point.role] = point.mmrAfter;
		} else {
			out.push({
				createdAt: point.createdAt,
				timeLabel: formatTime(point.createdAt),
				...lastValue,
			});
		}
	}
	return out;
}

function formatTime(unixSec: number): string {
	const date = new Date(unixSec * 1000);
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");
	const hour = `${date.getHours()}`.padStart(2, "0");
	return `${month}/${day} ${hour}시`;
}
