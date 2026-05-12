import * as adjustMmr from "./adjustMmr.js";
import * as auctionForceDelete from "./auctionForceDelete.js";
import * as auctionRecruit from "./auctionRecruit.js";
import * as auctionRecruitMemberAdd from "./auctionRecruitMemberAdd.js";
import * as auctionRecruitMemberRemove from "./auctionRecruitMemberRemove.js";
import * as bulkRegister from "./bulkRegister.js";
import * as cleanupStale from "./cleanupStale.js";
import * as currentGame from "./currentGame.js";
import * as earlyCompleteSeries from "./earlyCompleteSeries.js";
import * as forceDeleteRecruitment from "./forceDeleteRecruitment.js";
import * as forceDeleteSeries from "./forceDeleteSeries.js";
import * as history from "./history.js";
import * as leaderboard from "./leaderboard.js";
import * as logs from "./logs.js";
import * as lookup from "./lookup.js";
import * as recruit from "./recruit.js";
import * as recruitMemberAdd from "./recruitMemberAdd.js";
import * as randomRecruitMembers from "./randomRecruitMembers.js";
import * as recruitMemberRemove from "./recruitMemberRemove.js";
import * as refreshProfileIcon from "./refreshProfileIcon.js";
import * as register from "./register.js";
import * as resetSeasonResults from "./resetSeasonResults.js";
import * as seriesList from "./seriesList.js";
import * as whoami from "./whoami.js";

export const ALL_COMMANDS = [
	recruit,
	recruitMemberAdd,
	recruitMemberRemove,
	register,
	bulkRegister,
	whoami,
	history,
	leaderboard,
	lookup,
	currentGame,
	forceDeleteSeries,
	forceDeleteRecruitment,
	earlyCompleteSeries,
	adjustMmr,
	resetSeasonResults,
	cleanupStale,
	logs,
	seriesList,
	auctionRecruit,
	auctionRecruitMemberAdd,
	auctionRecruitMemberRemove,
	auctionForceDelete,
	refreshProfileIcon,
	randomRecruitMembers,
] as const;
