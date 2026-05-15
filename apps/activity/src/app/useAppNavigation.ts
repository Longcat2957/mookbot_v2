import { useState } from "react";
import type { StageKey } from "../components/Steps.js";

export interface AppNavigation {
	stage: StageKey;
	recruitmentId: number | null;
	seriesId: number | null;
	auctionRecruitmentId: number | null;
	auctionTournamentId: number | null;
	profileUserId: string | null;
	goHome: () => void;
	openProfile: (uid: string) => void;
	goBackFromProfile: () => void;
	openLeaderboard: () => void;
	openMinigame: () => void;
	openMyRiotAccounts: () => void;
	openRecruitment: (id: number) => void;
	openSeries: (id: number) => void;
	openCompletedSeries: (id: number) => void;
	openAuctionRecruitment: (id: number) => void;
	openAuctionTournament: (id: number) => void;
	enterSeries: (id: number) => void;
	enterAuctionTournament: (id: number) => void;
	enterAuctionBracket: (id: number) => void;
	enterAuctionResult: () => void;
}

export function useAppNavigation(): AppNavigation {
	const [stage, setStage] = useState<StageKey>("LIST");
	const [recruitmentId, setRecruitmentId] = useState<number | null>(null);
	const [seriesId, setSeriesId] = useState<number | null>(null);
	const [auctionRecruitmentId, setAuctionRecruitmentId] = useState<number | null>(null);
	const [auctionTournamentId, setAuctionTournamentId] = useState<number | null>(null);
	const [profileUserId, setProfileUserId] = useState<string | null>(null);
	const [profileBackTo, setProfileBackTo] = useState<StageKey>("LIST");

	const goHome = () => {
		setStage("LIST");
		setRecruitmentId(null);
		setSeriesId(null);
		setAuctionRecruitmentId(null);
		setAuctionTournamentId(null);
		setProfileUserId(null);
	};

	const openProfile = (uid: string) => {
		setProfileBackTo(stage === "PROFILE" ? profileBackTo : stage);
		setProfileUserId(uid);
		setStage("PROFILE");
	};

	const goBackFromProfile = () => {
		setStage(profileBackTo);
		setProfileUserId(null);
	};

	return {
		stage,
		recruitmentId,
		seriesId,
		auctionRecruitmentId,
		auctionTournamentId,
		profileUserId,
		goHome,
		openProfile,
		goBackFromProfile,
		openLeaderboard: () => setStage("LEADERBOARD"),
		openMinigame: () => setStage("MINIGAME"),
		openMyRiotAccounts: () => setStage("MY_RIOT_ACCOUNTS"),
		openRecruitment: (id) => {
			setRecruitmentId(id);
			setSeriesId(null);
			setStage("ENTRY_EDITING");
		},
		openSeries: (id) => {
			setSeriesId(id);
			setRecruitmentId(null);
			setStage("IN_GAME");
		},
		openCompletedSeries: (id) => {
			setSeriesId(id);
			setRecruitmentId(null);
			setStage("COMPLETED");
		},
		openAuctionRecruitment: (id) => {
			setAuctionRecruitmentId(id);
			setAuctionTournamentId(null);
			setStage("AUCTION_DRAFT");
		},
		openAuctionTournament: (id) => {
			setAuctionTournamentId(id);
			setAuctionRecruitmentId(null);
			setStage("AUCTION_DRAFT");
		},
		enterSeries: (id) => {
			setSeriesId(id);
			setRecruitmentId(null);
			setStage("IN_GAME");
		},
		enterAuctionTournament: (id) => {
			setAuctionTournamentId(id);
			setAuctionRecruitmentId(null);
		},
		enterAuctionBracket: (id) => {
			setAuctionTournamentId(id);
			setStage("AUCTION_BRACKET");
		},
		enterAuctionResult: () => setStage("AUCTION_RESULT"),
	};
}
