import { SectionHeader, StatusBadge } from "../../components/DesignPrimitives.js";
import { LEADERBOARD_TABS, type LeaderboardTab } from "./types.js";

interface Props {
	tab: LeaderboardTab;
	seasonId: number | undefined;
	onBack: () => void;
}

export function LeaderboardHeader({ tab, seasonId, onBack }: Props) {
	const tabLabel = LEADERBOARD_TABS.find((item) => item.key === tab)?.label;
	const description =
		tab === "COMPOSITE"
			? "라인 가중평균 MMR — Σ(MMR × 게임수) ÷ Σ(게임수)"
			: `${tabLabel} 라인 시즌 MMR 랭킹`;

	return (
		<SectionHeader
			title={<span className="text-2xl">🏆 리더보드</span>}
			description={description}
			actions={
				<div className="flex items-center gap-2">
					{seasonId && <StatusBadge tone="neutral">시즌 {seasonId}</StatusBadge>}
					<button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
						← 대시보드
					</button>
				</div>
			}
		/>
	);
}
