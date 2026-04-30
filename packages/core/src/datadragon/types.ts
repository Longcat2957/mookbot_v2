// ============================================================
// Data Dragon Response Types
// ============================================================

export interface ChampionData {
	version: string;
	id: string;
	key: string;        // numeric string e.g. "64"
	name: string;       // localized name e.g. "뽀삐"
	title: string;
	blurb: string;
	info: { attack: number; defense: number; magic: number; difficulty: number };
	image: { full: string; sprite: string; group: string; x: number; y: number; w: number; h: number };
	tags: string[];
	partype: string;
	stats: Record<string, number>;
}

export interface ChampionListDto {
	type: string;
	format: string;
	version: string;
	data: Record<string, ChampionData>; // keyed by champion id string e.g. "Poppy"
}

export interface SummonerSpellData {
	id: string;
	name: string;
	description: string;
	tooltip: string;
	maxrank: number;
	cooldown: number[];
	cost: number[];
	effect: (number | null)[][];
	key: string;        // numeric string e.g. "4"
	summonerLevel: number;
	modes: string[];
	costType: string;
	maxammo: string;
	range: number[] | string;
	image: { full: string; sprite: string; group: string; x: number; y: number; w: number; h: number };
	resource: string;
}

export interface SummonerSpellListDto {
	type: string;
	version: string;
	data: Record<string, SummonerSpellData>; // keyed by spell key e.g. "SummonerFlash"
}

export interface ItemData {
	name: string;
	description: string;
	colloq: string;
	plaintext: string;
	into?: string[];
	image: { full: string; sprite: string; group: string; x: number; y: number; w: number; h: number };
	gold: { base: number; purchasable: boolean; total: number; sell: number };
	tags: string[];
	maps: Record<string, boolean>;
	stats: Record<string, number>;
}

export interface ItemListDto {
	type: string;
	version: string;
	basic: { name: string; rune: boolean; gold: { base: number; total: number; sell: number; purchasable: boolean }; image: { full: string; sprite: string; group: string; x: number; y: number; w: number; h: number } };
	data: Record<string, ItemData>; // keyed by item id string e.g. "1001"
}

export interface ProfileIconData {
	id: number;
	image: { full: string; sprite: string; group: string; x: number; y: number; w: number; h: number };
}

export interface ProfileIconListDto {
	type: string;
	version: string;
	data: Record<string, ProfileIconData>;
}