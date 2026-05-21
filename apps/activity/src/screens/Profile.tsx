import { lazy, Suspense, useState } from "react";
import { InlineNotice, SectionHeader, StatusBadge } from "../components/DesignPrimitives.js";
import { usePerms } from "../state/perms.js";
import { LaneMmrCard } from "./Profile/LaneMmrCard.js";
import { ProfileHeader } from "./Profile/ProfileHeader.js";
import { ProfileSkeleton } from "./Profile/ProfileSkeleton.js";
import { RecentGamesCard } from "./Profile/RecentGamesCard.js";
import { SoloRankedSideRecords } from "./Profile/SoloRankedSideRecords.js";
import { TopChampionsCard } from "./Profile/TopChampionsCard.js";
import { useProfileData } from "./Profile/useProfileData.js";

const Preferences = lazy(() =>
	import("./Profile/Preferences.js").then((module) => ({ default: module.Preferences })),
);
const MmrChart = lazy(() =>
	import("./Profile/MmrChart.js").then((module) => ({ default: module.MmrChart })),
);

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
	const [shouldLoadPreferences, setShouldLoadPreferences] = useState(false);
	const [shouldLoadMmrChart, setShouldLoadMmrChart] = useState(false);

	if (error) {
		return (
			<section className="space-y-3">
				<InlineNotice tone="error">프로필을 불러오지 못했습니다: {error}</InlineNotice>
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

			<section className="space-y-2">
				<SectionHeader
					title="라인별 MMR"
					description="현재 시즌 기준 라인별 성과입니다."
					className="px-1"
				/>
				<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
					{data.laneMmrs.map((m) => (
						<LaneMmrCard key={m.role} mmr={m} />
					))}
				</div>
			</section>

			<SoloRankedSideRecords records={data.soloRankedSideRecords} />

			{/* 라인별 선호 챔프 (게시판 텍스트 풀이의 페이지 대체) */}
			<details
				className="surface-soft rounded-lg"
				onToggle={(event) => {
					if (event.currentTarget.open) setShouldLoadPreferences(true);
				}}
			>
				<summary className="cursor-pointer text-sm font-medium px-3 py-2 select-none flex items-center gap-2">
					📌 선호 챔프
					{isMe && (
						<StatusBadge tone="neutral" variant="ghost" size="xs">
							편집 가능
						</StatusBadge>
					)}
				</summary>
				<div className="px-3 pb-3 pt-1">
					{shouldLoadPreferences && (
						<Suspense fallback={<div className="skeleton h-24 w-full rounded-lg" />}>
							<Preferences userId={userId} isMe={isMe} />
						</Suspense>
					)}
				</div>
			</details>

			<details
				className="surface-soft rounded-lg"
				onToggle={(event) => {
					if (event.currentTarget.open) setShouldLoadMmrChart(true);
				}}
			>
				<summary className="cursor-pointer text-sm font-medium px-3 py-2 select-none">
					📈 MMR 추이
				</summary>
				<div className="px-3 pb-3 pt-1">
					{shouldLoadMmrChart && (
						<Suspense fallback={<div className="skeleton h-48 w-full rounded-lg" />}>
							<MmrChart userId={userId} />
						</Suspense>
					)}
				</div>
			</details>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<TopChampionsCard champions={data.topChampions} />
				<RecentGamesCard games={data.recentGames} onSelectSeries={onSelectSeries} />
			</div>
		</section>
	);
}
