import { InlineNotice } from "../components/DesignPrimitives.js";
import { MeHero } from "../components/MeHero.js";
import { WelcomeCard } from "../components/WelcomeCard.js";
import { useDashboardData } from "../features/dashboard/useDashboardData.js";
import { AuctionSection } from "./RecruitmentList/AuctionSection.js";
import { CompletedSection } from "./RecruitmentList/CompletedSection.js";
import { DashboardHeader } from "./RecruitmentList/DashboardHeader.js";
import { PendingSection } from "./RecruitmentList/PendingSection.js";

export function RecruitmentList({
	onSelectRecruitment,
	onSelectSeries,
	onSelectCompletedSeries,
	onSelectAuctionRecruitment,
	onSelectAuctionTournament,
	onOpenLeaderboard,
	onOpenMinigame,
	onOpenHelp,
	onOpenMyProfile,
}: {
	onSelectRecruitment: (id: number) => void;
	onSelectSeries: (id: number) => void;
	onSelectCompletedSeries: (id: number) => void;
	onSelectAuctionRecruitment: (id: number) => void;
	onSelectAuctionTournament: (id: number) => void;
	onOpenLeaderboard: () => void;
	onOpenMinigame: () => void;
	onOpenHelp: () => void;
	onOpenMyProfile: () => void;
}) {
	const {
		page,
		setPage,
		recruitments,
		series,
		auctionRecs,
		completed,
		completedTotal,
		totalPages,
		error,
		isLoading,
		pending,
		refresh,
	} = useDashboardData();

	if (error) {
		return (
			<section className="space-y-4">
				<DashboardHeader onRefresh={refresh} />
				<InlineNotice tone="error">목록을 불러오지 못했습니다: {error}</InlineNotice>
			</section>
		);
	}

	const recruitmentItems = recruitments ?? [];
	const seriesItems = series ?? [];
	const auctionRecItems = auctionRecs ?? [];
	const completedItems = completed ?? [];

	return (
		<section className="space-y-6">
			<DashboardHeader onRefresh={refresh} />

			{/* 본인 요약 카드 — op.gg 스타일 (라인별 MMR + 시즌 W/L) */}
			<MeHero onSelectMe={onOpenMyProfile} />

			{/* 신규 사용자 안내 — 한 번만 표시 (localStorage dismiss) */}
			<WelcomeCard
				onOpenLeaderboard={onOpenLeaderboard}
				onOpenMinigame={onOpenMinigame}
				onOpenHelp={onOpenHelp}
			/>

			<PendingSection
				isLoading={isLoading}
				pending={pending}
				recruitments={recruitmentItems}
				series={seriesItems}
				onSelectRecruitment={onSelectRecruitment}
				onSelectSeries={onSelectSeries}
			/>

			<AuctionSection
				isLoading={isLoading}
				auctionRecs={auctionRecItems}
				onSelectAuctionRecruitment={onSelectAuctionRecruitment}
				onSelectAuctionTournament={onSelectAuctionTournament}
			/>

			<div className="divider my-0 opacity-50" />

			<CompletedSection
				isLoading={isLoading}
				completed={completedItems}
				completedTotal={completedTotal}
				page={page}
				totalPages={totalPages}
				setPage={setPage}
				onSelectCompletedSeries={onSelectCompletedSeries}
			/>
		</section>
	);
}
