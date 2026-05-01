import * as recruit from "./recruit.js";
import * as register from "./register.js";
import * as bulkRegister from "./bulkRegister.js";
import * as whoami from "./whoami.js";
import * as history from "./history.js";
import * as leaderboard from "./leaderboard.js";
import * as lookup from "./lookup.js";
import * as currentGame from "./currentGame.js";
import * as forceDeleteSeries from "./forceDeleteSeries.js";
import * as adjustMmr from "./adjustMmr.js";
import * as resetSeasonResults from "./resetSeasonResults.js";
import * as cleanupStale from "./cleanupStale.js";

export const ALL_COMMANDS = [
	recruit,
	register,
	bulkRegister,
	whoami,
	history,
	leaderboard,
	lookup,
	currentGame,
	forceDeleteSeries,
	adjustMmr,
	resetSeasonResults,
	cleanupStale,
] as const;
