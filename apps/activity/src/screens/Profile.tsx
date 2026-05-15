import { usePerms } from "../state/perms.js";
import { LaneMmrCard } from "./Profile/LaneMmrCard.js";
import { MmrChart } from "./Profile/MmrChart.js";
import { Preferences } from "./Profile/Preferences.js";
import { ProfileHeader } from "./Profile/ProfileHeader.js";
import { ProfileSkeleton } from "./Profile/ProfileSkeleton.js";
import { RecentGamesCard } from "./Profile/RecentGamesCard.js";
import { TopChampionsCard } from "./Profile/TopChampionsCard.js";
import { useProfileData } from "./Profile/useProfileData.js";

export function Profile({
	userId,
	onBack,
	onSelectSeries,
	onManageRiotAccounts,
}: {
	userId: string;
	onBack: () => void;
	onSelectSeries: (seriesId: number) => void;
	onManageRiotAccounts?: () => void;
}) {
	const perms = usePerms();
	const isMe = perms.discordId === userId;
	const { data, error } = useProfileData(userId);

	if (error) {
		return (
			<section className="space-y-3">
				<div className="alert alert-error">
					<span>프로필을 불러오지 못했습니다: {error}</span>
				</div>
				<button type="button" className="btn btn-sm btn-outline" onClick={onBack}>
					← 돌아가기
				</button>
			</section>
		);
	}
	if (!data) {
		return <ProfileSkeleton />;
	}

	return (
		<section className="space-y-4">
			<ProfileHeader
				data={data}
				isMe={isMe}
				onBack={onBack}
				{...(onManageRiotAccounts ? { onManageRiotAccounts } : {})}
			/>

			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
				{data.laneMmrs.map((m) => (
					<LaneMmrCard key={m.role} mmr={m} />
				))}
			</div>

			{/* 라인별 선호 챔프 (게시판 텍스트 풀이의 페이지 대체) */}
			<details className="surface-soft rounded-lg" open>
				<summary className="cursor-pointer text-sm font-medium px-3 py-2 select-none flex items-center gap-2">
					📌 선호 챔프
					{isMe && <span className="badge badge-ghost badge-xs">편집 가능</span>}
				</summary>
				<div className="px-3 pb-3 pt-1">
					<Preferences userId={userId} isMe={isMe} />
				</div>
			</details>

			<details className="surface-soft rounded-lg">
				<summary className="cursor-pointer text-sm font-medium px-3 py-2 select-none">
					📈 MMR 추이
				</summary>
				<div className="px-3 pb-3 pt-1">
					<MmrChart userId={userId} />
				</div>
			</details>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<TopChampionsCard champions={data.topChampions} />
				<RecentGamesCard games={data.recentGames} onSelectSeries={onSelectSeries} />
			</div>
		</section>
	);
}
