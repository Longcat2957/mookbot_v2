import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { type ChartRow, ROLE_COLOR, ROLE_LABEL, ROLES, type Role } from "./types.js";

export function MmrLineChart({ rows, activeRoles }: { rows: ChartRow[]; activeRoles: Set<Role> }) {
	return (
		<div style={{ width: "100%", height: 240 }}>
			<ResponsiveContainer>
				<LineChart data={rows} margin={{ top: 8, right: 12, bottom: 8, left: -12 }}>
					<CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
					<XAxis
						dataKey="timeLabel"
						tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }}
						stroke="currentColor"
						strokeOpacity={0.3}
					/>
					<YAxis
						domain={["auto", "auto"]}
						tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }}
						stroke="currentColor"
						strokeOpacity={0.3}
					/>
					<Tooltip
						contentStyle={{
							background: "var(--color-base-100)",
							border: "1px solid var(--color-base-300)",
							borderRadius: 8,
							fontSize: 12,
						}}
						labelStyle={{ color: "var(--color-base-content)", opacity: 0.6 }}
					/>
					{ROLES.filter((role) => activeRoles.has(role)).map((role) => (
						<Line
							key={role}
							type="monotone"
							dataKey={role}
							name={ROLE_LABEL[role]}
							stroke={ROLE_COLOR[role]}
							strokeWidth={2}
							dot={{ r: 2, strokeWidth: 1 }}
							activeDot={{ r: 5 }}
							connectNulls
							isAnimationActive={false}
						/>
					))}
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
}
