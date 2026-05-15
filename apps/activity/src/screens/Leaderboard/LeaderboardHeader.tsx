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
		<div className="flex items-start justify-between gap-3 flex-wrap">
			<div>
				<h1 className="text-2xl font-bold">🏆 리더보드</h1>
				<p className="text-sm text-base-content/70">
					{description}
					{seasonId ? ` · 시즌 ${seasonId}` : ""}
				</p>
			</div>
			<button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
				← 대시보드
			</button>
		</div>
	);
}
