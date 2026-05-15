export interface SearchHit {
	discordId: string;
	displayName: string;
	profileIconUrl: string | null;
	mainAccount: { gameName: string; tagLine: string } | null;
	topChampion: {
		championId: number;
		championName: string;
		iconUrl: string;
		splashUrl: string;
	} | null;
}

export interface SearchResponse {
	query: string;
	users: SearchHit[];
}
