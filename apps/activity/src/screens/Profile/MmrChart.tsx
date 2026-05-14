// MMR 시계열 그래프 — Recharts.
// 라인 5개 토글 (체크박스), x = 시간, y = MMR after.

import { useEffect, useMemo, useState } from "react";
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { api } from "../../api/rest.js";

const ROLES = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;
type Role = (typeof ROLES)[number];

const ROLE_LABEL: Record<Role, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};

const ROLE_COLOR: Record<Role, string> = {
	TOP: "#3b82f6", // blue
	JUNGLE: "#22c55e", // green
	MID: "#a855f7", // purple
	BOTTOM: "#f59e0b", // amber
	SUPPORT: "#ec4899", // pink
};

interface HistoryPoint {
	createdAt: number;
	gameId: number;
	role: Role;
	mmrBefore: number;
	mmrAfter: number;
	delta: number;
}

interface HistoryResponse {
	userId: string;
	role: string | null;
	seasonId: number | null;
	points: HistoryPoint[];
}

interface ChartRow {
	createdAt: number;
	timeLabel: string;
	TOP?: number;
	JUNGLE?: number;
	MID?: number;
	BOTTOM?: number;
	SUPPORT?: number;
}

export function MmrChart({ userId }: { userId: string }) {
	const [activeRoles, setActiveRoles] = useState<Set<Role>>(new Set(ROLES));
	const [data, setData] = useState<HistoryResponse | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setData(null);
		setError(null);
		api<HistoryResponse>(`/users/${userId}/mmr-history?limit=200`)
			.then(setData)
			.catch((e) => setError(e instanceof Error ? e.message : String(e)));
	}, [userId]);

	// data.points 를 X 시간순 chart row 로 정규화 — 같은 시점 여러 라인일 수 있어 createdAt 단위 group.
	// 라인별로 시계열 — 라인이 안 바뀐 시점은 이전 값 forward-fill.
	// useMemo — points 가 동일하면 sort/normalize 재실행 안 함 (toggleRole 등으로 re-render 시 비용 절약).
	// hooks 순서 일관성 위해 early return 위에 위치 (data null 시 빈 배열 반환).
	const rows = useMemo<ChartRow[]>(() => {
		if (!data) return [];
		const out: ChartRow[] = [];
		const lastValue: Partial<Record<Role, number>> = {};
		const sorted = [...data.points].sort((a, b) => a.createdAt - b.createdAt);
		for (const p of sorted) {
			lastValue[p.role] = p.mmrAfter;
			const last = out[out.length - 1];
			const sec = p.createdAt;
			if (last && last.createdAt === sec) {
				last[p.role] = p.mmrAfter;
			} else {
				out.push({
					createdAt: sec,
					timeLabel: formatTime(sec),
					...lastValue,
				});
			}
		}
		return out;
	}, [data]);

	if (error) {
		return (
			<div className="alert alert-warning text-sm">
				<span>MMR 그래프 로드 실패: {error}</span>
			</div>
		);
	}
	if (!data) {
		return <div className="skeleton h-48 w-full rounded-lg" />;
	}
	if (data.points.length === 0) {
		return (
			<div className="text-center text-sm text-base-content/50 py-12 border border-base-300 rounded-lg">
				MMR 변동 기록이 없습니다.
			</div>
		);
	}

	const toggleRole = (role: Role) => {
		setActiveRoles((prev) => {
			const next = new Set(prev);
			if (next.has(role)) next.delete(role);
			else next.add(role);
			return next;
		});
	};

	return (
		<div className="space-y-2">
			<div className="flex flex-wrap gap-2">
				{ROLES.map((role) => {
					const active = activeRoles.has(role);
					return (
						<button
							key={role}
							type="button"
							onClick={() => toggleRole(role)}
							className={`btn btn-xs ${active ? "" : "btn-ghost opacity-60"}`}
							style={{
								borderColor: active ? ROLE_COLOR[role] : "transparent",
								color: active ? ROLE_COLOR[role] : undefined,
							}}
							aria-pressed={active}
						>
							<span
								className="inline-block w-2 h-2 rounded-full mr-1"
								style={{ background: ROLE_COLOR[role] }}
							/>
							{ROLE_LABEL[role]}
						</button>
					);
				})}
			</div>
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
						{ROLES.filter((r) => activeRoles.has(r)).map((role) => (
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
		</div>
	);
}

function formatTime(unixSec: number): string {
	const d = new Date(unixSec * 1000);
	const m = `${d.getMonth() + 1}`.padStart(2, "0");
	const day = `${d.getDate()}`.padStart(2, "0");
	const h = `${d.getHours()}`.padStart(2, "0");
	return `${m}/${day} ${h}시`;
}
