import { useState } from "react";
import { EmptyState } from "../components/EmptyState.js";
import { usePerms } from "../state/perms.js";
import { LeaderboardHeader } from "./Leaderboard/LeaderboardHeader.js";
import { LeaderboardTable } from "./Leaderboard/LeaderboardTable.js";
import { LeaderboardTabs } from "./Leaderboard/LeaderboardTabs.js";
import { TableSkeleton } from "./Leaderboard/TableSkeleton.js";
import type { LeaderboardTab } from "./Leaderboard/types.js";
import { useLeaderboardData } from "./Leaderboard/useLeaderboardData.js";

export function Leaderboard({
	onBack,
	onSelectUser,
}: {
	onBack: () => void;
	onSelectUser: (userId: string) => void;
}) {
	const [tab, setTab] = useState<LeaderboardTab>("TOP");
	const perms = usePerms();
	const { data, error } = useLeaderboardData(tab);

	return (
		<section className="space-y-4">
			<LeaderboardHeader tab={tab} seasonId={data?.seasonId} onBack={onBack} />
			<LeaderboardTabs activeTab={tab} onChange={setTab} />

			{error ? (
				<div className="alert alert-error">
					<span>리더보드를 불러오지 못했습니다: {error}</span>
				</div>
			) : !data ? (
				<TableSkeleton />
			) : data.rows.length === 0 ? (
				<EmptyState
					title="아직 기록이 없습니다"
					description="이번 시즌의 게임 기록이 쌓이면 여기에 표시됩니다."
					tone="info"
				/>
			) : (
				<LeaderboardTable rows={data.rows} myUserId={perms.discordId} onSelectUser={onSelectUser} />
			)}
		</section>
	);
}
