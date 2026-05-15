import { lazy } from "react";

export const loadRecruitmentList = () =>
	import("../screens/RecruitmentList.js").then((module) => ({ default: module.RecruitmentList }));
export const loadEntryEditing = () =>
	import("../screens/EntryEditing.js").then((module) => ({ default: module.EntryEditing }));
export const loadPickBan = () =>
	import("../screens/PickBan.js").then((module) => ({ default: module.PickBan }));
export const loadSeriesResult = () =>
	import("../screens/SeriesResult.js").then((module) => ({ default: module.SeriesResult }));
export const loadMiniGame = () =>
	import("../screens/MiniGame.js").then((module) => ({ default: module.MiniGame }));
export const loadLeaderboard = () =>
	import("../screens/Leaderboard.js").then((module) => ({ default: module.Leaderboard }));
export const loadProfile = () =>
	import("../screens/Profile.js").then((module) => ({ default: module.Profile }));
export const loadMyRiotAccounts = () =>
	import("../screens/MyRiotAccounts.js").then((module) => ({ default: module.MyRiotAccounts }));
export const loadAuctionDraft = () =>
	import("../screens/Auction/AuctionDraft.js").then((module) => ({ default: module.AuctionDraft }));
export const loadAuctionBracket = () =>
	import("../screens/Auction/AuctionBracket.js").then((module) => ({
		default: module.AuctionBracket,
	}));
export const loadAuctionResult = () =>
	import("../screens/Auction/AuctionResult.js").then((module) => ({
		default: module.AuctionResult,
	}));

export const RecruitmentList = lazy(loadRecruitmentList);
export const EntryEditing = lazy(loadEntryEditing);
export const PickBan = lazy(loadPickBan);
export const SeriesResult = lazy(loadSeriesResult);
export const MiniGame = lazy(loadMiniGame);
export const Leaderboard = lazy(loadLeaderboard);
export const Profile = lazy(loadProfile);
export const MyRiotAccounts = lazy(loadMyRiotAccounts);
export const AuctionDraft = lazy(loadAuctionDraft);
export const AuctionBracket = lazy(loadAuctionBracket);
export const AuctionResult = lazy(loadAuctionResult);
