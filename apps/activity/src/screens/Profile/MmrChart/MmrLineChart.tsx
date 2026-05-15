import { type ChartRow, ROLE_COLOR, ROLE_LABEL, ROLES, type Role } from "./types.js";

export function MmrLineChart({ rows, activeRoles }: { rows: ChartRow[]; activeRoles: Set<Role> }) {
	const width = 720;
	const height = 240;
	const padding = { top: 16, right: 18, bottom: 28, left: 42 };
	const chartWidth = width - padding.left - padding.right;
	const chartHeight = height - padding.top - padding.bottom;
	const active = ROLES.filter((role) => activeRoles.has(role));
	const values = active.flatMap((role) => rows.map((row) => row[role]).filter(isNumber));

	if (rows.length === 0 || values.length === 0) {
		return (
			<div className="h-60 rounded-lg border border-base-300 flex items-center justify-center text-sm text-base-content/50">
				표시할 MMR 데이터가 없습니다.
			</div>
		);
	}

	const rawMin = Math.min(...values);
	const rawMax = Math.max(...values);
	const rangePadding = Math.max(20, Math.round((rawMax - rawMin) * 0.08));
	const min = rawMin === rawMax ? rawMin - 50 : rawMin - rangePadding;
	const max = rawMin === rawMax ? rawMax + 50 : rawMax + rangePadding;
	const yTicks = buildTicks(min, max, 4);
	const xTicks = buildXTicks(rows);
	const xFor = (index: number) =>
		padding.left + (rows.length <= 1 ? chartWidth / 2 : (index / (rows.length - 1)) * chartWidth);
	const yFor = (value: number) => padding.top + ((max - value) / (max - min)) * chartHeight;

	return (
		<div className="h-60 w-full rounded-lg border border-base-300 bg-base-100/40">
			<svg
				role="img"
				aria-label="라인별 MMR 추이"
				className="h-full w-full overflow-visible"
				viewBox={`0 0 ${width} ${height}`}
			>
				<title>라인별 MMR 추이</title>
				{yTicks.map((tick) => {
					const y = yFor(tick);
					return (
						<g key={tick}>
							<line
								x1={padding.left}
								x2={width - padding.right}
								y1={y}
								y2={y}
								stroke="currentColor"
								strokeOpacity="0.08"
								strokeDasharray="4 4"
							/>
							<text
								x={padding.left - 8}
								y={y + 4}
								textAnchor="end"
								className="fill-current text-[11px] opacity-50"
							>
								{tick}
							</text>
						</g>
					);
				})}
				{xTicks.map((index) => (
					<text
						key={`${index}-${rows[index]?.timeLabel}`}
						x={xFor(index)}
						y={height - 8}
						textAnchor={index === 0 ? "start" : index === rows.length - 1 ? "end" : "middle"}
						className="fill-current text-[11px] opacity-50"
					>
						{rows[index]?.timeLabel}
					</text>
				))}
				{active.map((role) => (
					<g key={role}>
						<path
							d={linePath(rows, role, xFor, yFor)}
							fill="none"
							stroke={ROLE_COLOR[role]}
							strokeWidth="2.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							vectorEffect="non-scaling-stroke"
						/>
						{rows.map((row, index) => {
							const value = row[role];
							if (typeof value !== "number") return null;
							return (
								<circle
									key={`${role}-${row.createdAt}-${value}`}
									cx={xFor(index)}
									cy={yFor(value)}
									r="2.5"
									fill={ROLE_COLOR[role]}
								>
									<title>
										{ROLE_LABEL[role]} · {row.timeLabel} · {value}
									</title>
								</circle>
							);
						})}
					</g>
				))}
			</svg>
		</div>
	);
}

function isNumber(value: unknown): value is number {
	return typeof value === "number";
}

function buildTicks(min: number, max: number, count: number) {
	const step = (max - min) / Math.max(1, count - 1);
	return Array.from({ length: count }, (_, index) => Math.round(min + step * index));
}

function buildXTicks(rows: ChartRow[]) {
	if (rows.length <= 1) return [0];
	const middle = Math.floor((rows.length - 1) / 2);
	return Array.from(new Set([0, middle, rows.length - 1]));
}

function linePath(
	rows: ChartRow[],
	role: Role,
	xFor: (index: number) => number,
	yFor: (value: number) => number,
) {
	let path = "";
	let hasPoint = false;
	rows.forEach((row, index) => {
		const value = row[role];
		if (typeof value !== "number") return;
		path += `${hasPoint ? "L" : "M"}${xFor(index).toFixed(2)} ${yFor(value).toFixed(2)} `;
		hasPoint = true;
	});
	return path.trim();
}
