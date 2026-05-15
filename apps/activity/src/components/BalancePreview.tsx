import { useMemo, useState } from "react";
import { buildBalanceSummary, sideTheme } from "./BalancePreview/balancePreviewLogic.js";
import { MatchupRows } from "./BalancePreview/MatchupRows.js";
import { SummaryRow } from "./BalancePreview/SummaryRow.js";
import { TeamHeader } from "./BalancePreview/TeamHeader.js";
import type { BalanceParticipant, Side } from "./BalancePreview/types.js";

interface Props {
	team1Side: Side;
	participants: BalanceParticipant[];
}

export function BalancePreview({ team1Side, participants }: Props) {
	const team2Side: Side = team1Side === "BLUE" ? "RED" : "BLUE";
	const t1Theme = sideTheme(team1Side);
	const t2Theme = sideTheme(team2Side);

	const { byTeamLane, activeLanes, t1Avg, t2Avg } = useMemo(
		() => buildBalanceSummary(participants),
		[participants],
	);

	// 펼친 플레이어 키 ("TEAM_1_TOP" 등) 의 set. 행을 직접 클릭하거나
	// 헤더의 "전체 열기" 로 전체 토글.
	const allKeys = useMemo(
		() => activeLanes.flatMap((l) => [`TEAM_1_${l}`, `TEAM_2_${l}`]),
		[activeLanes],
	);
	const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());
	const anyOpen = openKeys.size > 0;
	const toggleAll = () => {
		setOpenKeys(anyOpen ? new Set() : new Set(allKeys));
	};
	const toggleOne = (key: string, open: boolean) => {
		setOpenKeys((prev) => {
			const next = new Set(prev);
			if (open) next.add(key);
			else next.delete(key);
			return next;
		});
	};

	return (
		<details className="collapse collapse-arrow bg-base-200 shadow-sm" open>
			<summary className="collapse-title text-sm font-medium py-2 min-h-0 px-3">
				🎯 밸런스 미리보기 (Game 1 · 1팀 {team1Side})
			</summary>
			<div className="collapse-content px-3 pb-3 space-y-3">
				<TeamHeader
					team1Side={team1Side}
					team2Side={team2Side}
					t1Badge={t1Theme.badge}
					t2Badge={t2Theme.badge}
				/>
				<MatchupRows
					activeLanes={activeLanes}
					byTeamLane={byTeamLane}
					t1Border={t1Theme.border}
					t2Border={t2Theme.border}
					openKeys={openKeys}
					onToggle={toggleOne}
				/>
				<SummaryRow t1Avg={t1Avg} t2Avg={t2Avg} t1Text={t1Theme.text} t2Text={t2Theme.text} />

				{/* 전체 열기/닫기 */}
				<div className="flex justify-center">
					<button type="button" className="btn btn-xs btn-ghost" onClick={toggleAll}>
						{anyOpen ? "전체 닫기" : "전체 열기"}
					</button>
				</div>
			</div>
		</details>
	);
}
