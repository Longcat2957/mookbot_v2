export interface Account {
	puuid: string;
	gameName: string;
	tagLine: string;
	isMain: boolean;
	profileIconUrl: string | null;
}

export interface ListResponse {
	accounts: Account[];
}

export interface LinkResponse {
	account: Account | null;
}

export interface LinkFormState {
	riotId: string;
	busy: boolean;
	error: string | null;
}

export const LINK_FORM_INITIAL: LinkFormState = { riotId: "", busy: false, error: null };
