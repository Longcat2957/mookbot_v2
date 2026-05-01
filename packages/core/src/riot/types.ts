// ============================================================
// Riot API Response Types
// ============================================================

// --- Account v1 ---

export interface AccountDto {
	puuid: string;
	gameName: string;
	tagLine: string;
}

// --- Spectator v5 — current live game ---

export interface CurrentGameInfoDto {
	gameId: number;
	mapId: number;
	gameMode: string;
	gameType: string;
	gameQueueConfigId: number;
	gameLength: number; // seconds
	gameStartTime: number; // ms
	platformId: string;
	participants: CurrentGameParticipantDto[];
	bannedChampions?: Array<{ championId: number; teamId: number; pickTurn: number }>;
}

export interface CurrentGameParticipantDto {
	puuid: string;
	championId: number;
	teamId: number; // 100 = blue, 200 = red
	spell1Id: number;
	spell2Id: number;
	riotId?: string;
	summonerId?: string;
	bot: boolean;
}

// --- Summoner v4 ---

export interface SummonerDto {
	id?: string; // deprecated — may be missing
	accountId?: string; // deprecated — may be missing
	puuid: string;
	name?: string; // deprecated — may be missing
	profileIconId: number;
	revisionDate: number;
	summonerLevel: number;
}

// --- League v4 ---

export type Tier =
	| "IRON"
	| "BRONZE"
	| "SILVER"
	| "GOLD"
	| "PLATINUM"
	| "EMERALD"
	| "DIAMOND"
	| "MASTER"
	| "GRANDMASTER"
	| "CHALLENGER";

export type Rank = "I" | "II" | "III" | "IV";

export type QueueType = "RANKED_SOLO_5x5" | "RANKED_FLEX_SR" | "RANKED_FLEX_TT";

export interface LeagueEntryDto {
	leagueId: string;
	summonerId: string;
	summonerName: string;
	queueType: QueueType;
	tier: Tier;
	rank: Rank;
	leaguePoints: number;
	wins: number;
	losses: number;
	hotStreak: boolean;
	veteran: boolean;
	freshBlood: boolean;
	inactive: boolean;
	miniSeries?: MiniSeriesDto;
}

export interface MiniSeriesDto {
	losses: number;
	progress: string;
	target: number;
	wins: number;
}

// --- Champion Mastery v4 ---

export interface ChampionMasteryDto {
	puuid: string;
	championId: number;
	championLevel: number;
	championPoints: number;
	lastPlayTime: number;
	championPointsSinceLastLevel: number;
	championPointsUntilNextLevel: number;
	chestGranted: boolean;
	tokensEarned: number;
}

// --- Match v5 ---

export interface MatchDto {
	metadata: MatchMetadataDto;
	info: MatchInfoDto;
}

export interface MatchMetadataDto {
	dataVersion: string;
	matchId: string;
	participants: string[];
}

export interface MatchInfoDto {
	gameCreation: number;
	gameDuration: number;
	gameEndTimestamp: number;
	gameId: number;
	gameMode: string;
	gameName: string;
	gameStartTimestamp: number;
	gameType: string;
	gameVersion: string;
	mapId: number;
	participants: MatchParticipantDto[];
	platformId: string;
	queueId: number;
	teams: MatchTeamDto[];
	tournamentCode: string;
}

export interface MatchParticipantDto {
	assists: number;
	baronKills: number;
	bountyLevel: number;
	champExperience: number;
	champLevel: number;
	championId: number;
	championName: string;
	championTransform: number;
	consumablesPurchased: number;
	damageDealtToBuildings: number;
	damageDealtToObjectives: number;
	damageDealtToTurrets: number;
	damageSelfMitigated: number;
	deaths: number;
	detectorWardsPlaced: number;
	doubleKills: number;
	dragonKills: number;
	eligibleForProgression: boolean;
	firstBloodAssist: boolean;
	firstBloodKill: boolean;
	firstTowerAssist: boolean;
	firstTowerKill: boolean;
	gameEndedInEarlySurrender: boolean;
	gameEndedInSurrender: boolean;
	goldEarned: number;
	goldSpent: number;
	individualPosition: string;
	inhibitorKills: number;
	inhibitorTakedowns: number;
	inhibitorsLost: number;
	item0: number;
	item1: number;
	item2: number;
	item3: number;
	item4: number;
	item5: number;
	item6: number;
	itemsPurchased: number;
	killingSprees: number;
	kills: number;
	lane: string;
	largestCriticalStrike: number;
	largestKillingSpree: number;
	largestMultiKill: number;
	longestTimeSpentLiving: number;
	magicDamageDealt: number;
	magicDamageDealtToChampions: number;
	magicDamageTaken: number;
	neutralMinionsKilled: number;
	neutralMinionsKilledTeamJungle: number;
	neutralMinionsKilledEnemyJungle: number;
	objectiveDamageDealt: number;
	objectivesStolen: number;
	objectivesStolenAssists: number;
	pentaKills: number;
	perks: PerksDto;
	physicalDamageDealt: number;
	physicalDamageDealtToChampions: number;
	physicalDamageTaken: number;
	profileIcon: number;
	puuid: string;
	qquadraKills: number;
	riotIdGameName: string;
	riotIdTagline: string;
	role: string;
	sightWardsBoughtInGame: number;
	spell1Casts: number;
	spell2Casts: number;
	spell3Casts: number;
	spell4Casts: number;
	summoner1Id: number;
	summoner2Id: number;
	summonerId: string;
	summonerLevel: number;
	summonerName: string;
	teamEarlySurrendered: boolean;
	teamId: number;
	teamPosition: string;
	timeCCingOthers: number;
	timePlayed: number;
	totalDamageDealt: number;
	totalDamageDealtToChampions: number;
	totalDamageShieldedOnTeammates: number;
	totalDamageTaken: number;
	totalHeal: number;
	totalHealsOnTeammates: number;
	totalMinionsKilled: number;
	totalTimeCCDealt: number;
	totalTimeSpentDead: number;
	totalUnitsHealed: number;
	tripleKills: number;
	trueDamageDealt: number;
	trueDamageDealtToChampions: number;
	trueDamageTaken: number;
	turretKills: number;
	turretTakedowns: number;
	turretsLost: number;
	unicornKills: number;
	visionScore: number;
	visionWardsBoughtInGame: number;
	wardsKilled: number;
	wardsPlaced: number;
	win: boolean;
}

export interface PerksDto {
	styles: PerkStyleDto[];
}

export interface PerkStyleDto {
	description: string;
	selections: PerkStyleSelectionDto[];
	style: number;
}

export interface PerkStyleSelectionDto {
	perk: number;
	var1: number;
	var2: number;
	var3: number;
}

export interface MatchTeamDto {
	teamId: number;
	win: boolean;
	objectives: {
		barons?: ObjectiveDto;
		champions?: ObjectiveDto;
		dragons?: ObjectiveDto;
		inhibitors?: ObjectiveDto;
		ridleyHeralds?: ObjectiveDto;
		towers?: ObjectiveDto;
	};
	bans?: MatchTeamBanDto[];
}

export interface ObjectiveDto {
	first: boolean;
	kills: number;
}

export interface MatchTeamBanDto {
	championId: number;
	pickTurn: number;
}

// --- Convenience / Aggregated Types ---

export interface PlayerProfile {
	account: AccountDto;
	summoner: SummonerDto;
	leagueEntries: LeagueEntryDto[];
	topMasteries: ChampionMasteryDto[];
}
