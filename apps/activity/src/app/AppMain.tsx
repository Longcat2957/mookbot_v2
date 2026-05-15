import { type ReactNode, Suspense } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary.js";
import { Steps } from "../components/Steps.js";
import type { AuthedUser } from "../sdk/client.js";
import {
	AuctionBracket,
	AuctionDraft,
	AuctionResult,
	EntryEditing,
	Leaderboard,
	MiniGame,
	MyRiotAccounts,
	PickBan,
	Profile,
	RecruitmentList,
	SeriesResult,
} from "./screenLoaders.js";
import type { AppNavigation } from "./useAppNavigation.js";

function ScreenSuspense({ children }: { children: ReactNode }) {
	return (
		<Suspense
			fallback={
				<div className="min-h-72 flex items-center justify-center">
					<span className="loading loading-spinner loading-lg text-primary" />
				</div>
			}
		>
			{children}
		</Suspense>
	);
}

export function AppMain({
	user,
	nav,
	onOpenHelp,
}: {
	user: AuthedUser;
	nav: AppNavigation;
	onOpenHelp: () => void;
}) {
	return (
		<>
			{(nav.stage === "ENTRY_EDITING" || nav.stage === "IN_GAME" || nav.stage === "COMPLETED") && (
				<div className="bg-base-200/40 border-b border-base-300">
					<div className="max-w-screen-xl mx-auto py-2 px-4">
						<Steps current={nav.stage} />
					</div>
				</div>
			)}

			<main className="max-w-screen-xl mx-auto p-3 lg:p-4 w-full flex-1">
				{nav.stage === "LIST" && (
					<ErrorBoundary key="list" label="대시보드" onReset={nav.goHome}>
						<ScreenSuspense>
							<RecruitmentList
								onSelectRecruitment={nav.openRecruitment}
								onSelectSeries={nav.openSeries}
								onSelectCompletedSeries={nav.openCompletedSeries}
								onSelectAuctionRecruitment={nav.openAuctionRecruitment}
								onSelectAuctionTournament={nav.openAuctionTournament}
								onOpenLeaderboard={nav.openLeaderboard}
								onOpenMinigame={nav.openMinigame}
								onOpenHelp={onOpenHelp}
								onOpenMyProfile={() => nav.openProfile(user.id)}
							/>
						</ScreenSuspense>
					</ErrorBoundary>
				)}
				{nav.stage === "ENTRY_EDITING" && (
					<ErrorBoundary key={`entry-${nav.recruitmentId}`} label="엔트리 수정" onReset={nav.goHome}>
						<ScreenSuspense>
							<EntryEditing recruitmentId={nav.recruitmentId} onSubmit={nav.enterSeries} />
						</ScreenSuspense>
					</ErrorBoundary>
				)}
				{nav.stage === "IN_GAME" && (
					<ErrorBoundary key={`pickban-${nav.seriesId}`} label="픽 / 밴" onReset={nav.goHome}>
						<ScreenSuspense>
							<PickBan seriesId={nav.seriesId} onBack={nav.goHome} onSelectUser={nav.openProfile} />
						</ScreenSuspense>
					</ErrorBoundary>
				)}
				{nav.stage === "COMPLETED" && (
					<ErrorBoundary key={`result-${nav.seriesId}`} label="시리즈 결과" onReset={nav.goHome}>
						<ScreenSuspense>
							<SeriesResult seriesId={nav.seriesId} onBack={nav.goHome} onSelectUser={nav.openProfile} />
						</ScreenSuspense>
					</ErrorBoundary>
				)}
				{nav.stage === "MINIGAME" && (
					<ErrorBoundary key="minigame" label="도구" onReset={nav.goHome}>
						<ScreenSuspense>
							<MiniGame onBack={nav.goHome} />
						</ScreenSuspense>
					</ErrorBoundary>
				)}
				{nav.stage === "LEADERBOARD" && (
					<ErrorBoundary key="leaderboard" label="리더보드" onReset={nav.goHome}>
						<ScreenSuspense>
							<Leaderboard onBack={nav.goHome} onSelectUser={nav.openProfile} />
						</ScreenSuspense>
					</ErrorBoundary>
				)}
				{nav.stage === "PROFILE" && nav.profileUserId && (
					<ErrorBoundary key={`profile-${nav.profileUserId}`} label="프로필" onReset={nav.goHome}>
						<ScreenSuspense>
							<Profile
								userId={nav.profileUserId}
								onBack={nav.goBackFromProfile}
								onSelectSeries={nav.openCompletedSeries}
								onManageRiotAccounts={nav.openMyRiotAccounts}
							/>
						</ScreenSuspense>
					</ErrorBoundary>
				)}
				{nav.stage === "MY_RIOT_ACCOUNTS" && (
					<ErrorBoundary key="my-riot-accounts" label="라이엇 계정 관리" onReset={nav.goHome}>
						<ScreenSuspense>
							<MyRiotAccounts onBack={() => nav.openProfile(user.id)} />
						</ScreenSuspense>
					</ErrorBoundary>
				)}
				{nav.stage === "AUCTION_DRAFT" && (
					<ErrorBoundary
						key={`auction-draft-${nav.auctionTournamentId ?? nav.auctionRecruitmentId}`}
						label="경매내전 드래프트"
						onReset={nav.goHome}
					>
						<ScreenSuspense>
							<AuctionDraft
								tournamentId={nav.auctionTournamentId}
								recruitmentId={nav.auctionRecruitmentId}
								onEnterTournament={nav.enterAuctionTournament}
								onEnterBracket={nav.enterAuctionBracket}
							/>
						</ScreenSuspense>
					</ErrorBoundary>
				)}
				{nav.stage === "AUCTION_BRACKET" && (
					<ErrorBoundary
						key={`auction-bracket-${nav.auctionTournamentId}`}
						label="경매내전 토너먼트"
						onReset={nav.goHome}
					>
						<ScreenSuspense>
							<AuctionBracket
								tournamentId={nav.auctionTournamentId}
								onCompleted={nav.enterAuctionResult}
							/>
						</ScreenSuspense>
					</ErrorBoundary>
				)}
				{nav.stage === "AUCTION_RESULT" && (
					<ErrorBoundary
						key={`auction-result-${nav.auctionTournamentId}`}
						label="경매내전 결과"
						onReset={nav.goHome}
					>
						<ScreenSuspense>
							<AuctionResult tournamentId={nav.auctionTournamentId} onBack={nav.goHome} />
						</ScreenSuspense>
					</ErrorBoundary>
				)}
			</main>
		</>
	);
}
