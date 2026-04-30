// 확정된 엔트리를 3컬럼 그리드로 표시 — 라인 / 1팀 / 2팀.
// 미니멀 디자인 (회성/용호 스타일).

import { Fragment } from "react";

const LANE_LABEL: Record<string, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};

const LANE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;

export interface LineupParticipant {
	displayName: string;
	team: "TEAM_1" | "TEAM_2";
	role: string;
}

export function LineupPreview({
	participants,
	compact = false,
}: {
	participants: LineupParticipant[];
	compact?: boolean;
}) {
	const byTeamRole = new Map<string, string>();
	for (const p of participants) {
		byTeamRole.set(`${p.team}_${p.role}`, p.displayName);
	}
	// 활성 라인 = 양 팀 참가자에 등장한 라인의 합집합
	const activeLanes = LANE_ORDER.filter((l) =>
		participants.some((p) => p.role === l),
	);

	return (
		<div
			className={`grid grid-cols-3 gap-x-3 ${
				compact ? "gap-y-0.5 text-sm" : "gap-y-1 text-base"
			} font-bold tabular-nums`}
		>
			<div className="text-base-content/50 font-medium text-xs uppercase">라인</div>
			<div className="text-info text-xs uppercase font-medium">1팀</div>
			<div className="text-warning text-xs uppercase font-medium">2팀</div>
			{activeLanes.map((lane) => {
				const t1 = byTeamRole.get(`TEAM_1_${lane}`) ?? "—";
				const t2 = byTeamRole.get(`TEAM_2_${lane}`) ?? "—";
				return (
					<Fragment key={lane}>
						<div className="text-base-content/80">{LANE_LABEL[lane] ?? lane}</div>
						<div className="truncate">{t1}</div>
						<div className="truncate">{t2}</div>
					</Fragment>
				);
			})}
		</div>
	);
}
