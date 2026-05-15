import { useMemo, useState } from "react";
import { MmrLineChart } from "./MmrChart/MmrLineChart.js";
import { normalizeMmrRows } from "./MmrChart/mmrChartLogic.js";
import { RoleToggleBar } from "./MmrChart/RoleToggleBar.js";
import { type ChartRow, ROLES, type Role } from "./MmrChart/types.js";
import { useMmrHistory } from "./MmrChart/useMmrHistory.js";

export function MmrChart({ userId }: { userId: string }) {
	const [activeRoles, setActiveRoles] = useState<Set<Role>>(new Set(ROLES));
	const { data, error } = useMmrHistory(userId);

	const rows = useMemo<ChartRow[]>(() => {
		if (!data) return [];
		return normalizeMmrRows(data.points);
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
			<RoleToggleBar activeRoles={activeRoles} onToggle={toggleRole} />
			<MmrLineChart rows={rows} activeRoles={activeRoles} />
		</div>
	);
}
