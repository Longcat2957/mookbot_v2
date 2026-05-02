// 확정된 엔트리를 3컬럼 그리드로 표시 — 라인 / 1팀 / 2팀.
// 미니멀 디자인 (회성/용호 스타일).
//
// onSelectUser 가 제공되면 멤버 셀이 클릭 가능 → Profile 화면 진입.

import { Fragment, type ReactElement } from "react";

const LANE_LABEL: Record<string, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};

const LANE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;

export interface LineupParticipant {
	userId?: string;
	displayName: string;
	team: "TEAM_1" | "TEAM_2";
	role: string;
}

export function LineupPreview({
	participants,
	compact = false,
	onSelectUser,
}: {
	participants: LineupParticipant[];
	compact?: boolean;
	onSelectUser?: (userId: string) => void;
}) {
	const byTeamRole = new Map<string, LineupParticipant>();
	for (const p of participants) {
		byTeamRole.set(`${p.team}_${p.role}`, p);
	}
	const activeLanes = LANE_ORDER.filter((l) => participants.some((p) => p.role === l));

	const renderMember = (p: LineupParticipant | undefined): ReactElement => {
		if (!p) return <div>—</div>;
		const clickable = onSelectUser && p.userId;
		if (clickable) {
			return (
				<button
					type="button"
					onClick={() => onSelectUser(p.userId as string)}
					className="truncate text-left hover:text-primary hover:underline transition cursor-pointer min-w-0"
					title={`${p.displayName} 프로필 보기`}
				>
					{p.displayName}
				</button>
			);
		}
		return <div className="truncate">{p.displayName}</div>;
	};

	return (
		<div
			className={`grid grid-cols-3 gap-x-3 ${
				compact ? "gap-y-0.5 text-sm" : "gap-y-1 text-base"
			} font-bold tabular-nums`}
		>
			<div className="text-base-content/50 font-medium text-xs uppercase">라인</div>
			<div className="text-info text-xs uppercase font-medium">1팀</div>
			<div className="text-error text-xs uppercase font-medium">2팀</div>
			{activeLanes.map((lane) => (
				<Fragment key={lane}>
					<div className="text-base-content/80">{LANE_LABEL[lane] ?? lane}</div>
					{renderMember(byTeamRole.get(`TEAM_1_${lane}`))}
					{renderMember(byTeamRole.get(`TEAM_2_${lane}`))}
				</Fragment>
			))}
		</div>
	);
}
