import { log } from "../logger.js";
import type {
	ChampionData,
	ChampionListDto,
	ItemListDto,
	ProfileIconListDto,
	SummonerSpellListDto,
} from "./types.js";

// ============================================================
// Data Dragon CDN URLs
// ============================================================

const BASE_URL = "https://ddragon.leagueoflegends.com";
const LOCALE = "ko_KR";

// ============================================================
// Internal State
// ============================================================

let version = "";
let initialized = false;

// Lookup maps: numeric key → data
const championByKey = new Map<string, ChampionData>(); // "64" → ChampionData
const championByKoName = new Map<string, ChampionData>(); // "뽀삐" → ChampionData
const championByKoNameNoSpace = new Map<string, ChampionData>(); // "리신" (DD: "리 신") → ChampionData
const championByIdSlug = new Map<string, ChampionData>(); // "poppy" (lower) → ChampionData
const spellByKey = new Map<string, string>(); // "4" → spell name
const itemById = new Map<string, string>(); // "1001" → item name
const profileIconById = new Map<number, string>(); // 6362 → image filename

// ============================================================
// Initialization
// ============================================================

async function fetchLatestVersion(): Promise<string> {
	const res = await fetch(`${BASE_URL}/api/versions.json`);
	if (!res.ok) throw new Error(`Failed to fetch versions: ${res.status}`);
	const versions = (await res.json()) as string[];
	return versions[0]!;
}

async function fetchJson<T>(url: string): Promise<T> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Data Dragon fetch failed: ${res.status} [${url}]`);
	return (await res.json()) as T;
}

/**
 * Initialize Data Dragon data. Call once at bot startup.
 * Fetches the latest version and loads all static data into memory.
 */
export async function initDataDragon(): Promise<void> {
	if (initialized) return;

	version = await fetchLatestVersion();
	log.info({ ddVersion: version }, "datadragon version loaded");

	// Load champions
	const champDto = await fetchJson<ChampionListDto>(
		`${BASE_URL}/cdn/${version}/data/${LOCALE}/champion.json`,
	);
	for (const champ of Object.values(champDto.data)) {
		championByKey.set(champ.key, champ);
		championByKoName.set(champ.name, champ);
		// 공백 제거 변형도 인덱싱 — 유저가 "리신" / "마스터이" 입력해도 매치
		championByKoNameNoSpace.set(champ.name.replace(/\s+/g, ""), champ);
		championByIdSlug.set(champ.id.toLowerCase(), champ);
	}
	log.info({ count: championByKey.size }, "datadragon champions loaded");

	// Load summoner spells
	const spellDto = await fetchJson<SummonerSpellListDto>(
		`${BASE_URL}/cdn/${version}/data/${LOCALE}/summoner.json`,
	);
	for (const spell of Object.values(spellDto.data)) {
		spellByKey.set(spell.key, spell.name);
	}
	log.info({ count: spellByKey.size }, "datadragon spells loaded");

	// Load items
	const itemDto = await fetchJson<ItemListDto>(
		`${BASE_URL}/cdn/${version}/data/${LOCALE}/item.json`,
	);
	for (const [id, item] of Object.entries(itemDto.data)) {
		itemById.set(id, item.name);
	}
	log.info({ count: itemById.size }, "datadragon items loaded");

	// Load profile icons
	const iconDto = await fetchJson<ProfileIconListDto>(
		`${BASE_URL}/cdn/${version}/data/${LOCALE}/profileicon.json`,
	);
	for (const icon of Object.values(iconDto.data)) {
		profileIconById.set(icon.id, icon.image.full);
	}
	log.info({ count: profileIconById.size }, "datadragon profile icons loaded");

	initialized = true;
}

// ============================================================
// Lookup Functions
// ============================================================

/**
 * Get champion localized name by numeric ID.
 * e.g. 64 → "뽀삐"
 */
export function getChampionName(championId: number): string {
	return championByKey.get(String(championId))?.name ?? `Unknown(${championId})`;
}

/**
 * Get full champion data by numeric ID.
 */
export function getChampionData(championId: number): ChampionData | undefined {
	return championByKey.get(String(championId));
}

/**
 * Get champion image URL by numeric ID.
 */
export function getChampionImageUrl(championId: number): string {
	const champ = championByKey.get(String(championId));
	if (!champ) return "";
	return `${BASE_URL}/cdn/${version}/img/champion/${champ.image.full}`;
}

/**
 * Get champion splash art URL by numeric ID (가로형 1280x720, 메인 일러스트).
 * skin index 0 = base skin. 아바타에 object-cover 로 crop 해서 사용.
 */
export function getChampionSplashUrl(championId: number, skinNum = 0): string {
	const champ = championByKey.get(String(championId));
	if (!champ) return "";
	return `${BASE_URL}/cdn/img/champion/splash/${champ.id}_${skinNum}.jpg`;
}

/**
 * Get champion loading screen art URL by numeric ID (세로형 308x560, 캐릭터 위주).
 * splash 보다 캐릭터 중심 crop 이라 정사각 아바타에 더 자연스러움.
 */
export function getChampionLoadingUrl(championId: number, skinNum = 0): string {
	const champ = championByKey.get(String(championId));
	if (!champ) return "";
	return `${BASE_URL}/cdn/img/champion/loading/${champ.id}_${skinNum}.jpg`;
}

/**
 * Champion 전체 리스트 — Activity 픽/밴 그리드 / 검색용.
 */
export function getAllChampions(): {
	id: number;
	idSlug: string;
	name: string;
	iconUrl: string;
}[] {
	const out: { id: number; idSlug: string; name: string; iconUrl: string }[] = [];
	for (const champ of championByKey.values()) {
		out.push({
			id: Number(champ.key),
			idSlug: champ.id,
			name: champ.name,
			iconUrl: `${BASE_URL}/cdn/${version}/img/champion/${champ.image.full}`,
		});
	}
	out.sort((a, b) => a.name.localeCompare(b.name, "ko"));
	return out;
}

/**
 * Look up champion by Korean localized name OR English id slug (case-insensitive).
 * 픽/밴 입력 정규화·검증용. 공백 유무 모두 매치 ("리 신" 과 "리신" 둘 다 OK).
 */
export function findChampion(query: string): ChampionData | undefined {
	const trimmed = query.trim();
	if (!trimmed) return undefined;
	// 1. Korean name 정확 일치 ("리 신" 그대로)
	const ko = championByKoName.get(trimmed);
	if (ko) return ko;
	// 2. 공백 제거 한글 이름 ("리신" → "리 신")
	const noSpace = trimmed.replace(/\s+/g, "");
	const koNs = championByKoNameNoSpace.get(noSpace);
	if (koNs) return koNs;
	// 3. id slug (case-insensitive, "lee sin" → "leesin")
	return championByIdSlug.get(noSpace.toLowerCase());
}

/**
 * Korean name 또는 id slug 의 prefix 로 챔피언 검색.
 * 자동완성용 — 최대 limit 개의 ChampionData 반환.
 */
export function searchChampions(prefix: string, limit = 25): ChampionData[] {
	const q = prefix.trim().toLowerCase();
	const all = [...championByKoName.values()];
	if (!q) {
		return all.sort((a, b) => a.name.localeCompare(b.name, "ko")).slice(0, limit);
	}
	// Korean name 시작/포함 + id slug 시작 매칭
	const matches = all.filter((c) => {
		const ko = c.name.toLowerCase();
		const slug = c.id.toLowerCase();
		return ko.startsWith(q) || slug.startsWith(q) || ko.includes(q);
	});
	matches.sort((a, b) => {
		// 정확 일치 → prefix 일치 → 부분 일치 순
		const aExact = a.name.toLowerCase() === q || a.id.toLowerCase() === q ? 0 : 1;
		const bExact = b.name.toLowerCase() === q || b.id.toLowerCase() === q ? 0 : 1;
		if (aExact !== bExact) return aExact - bExact;
		const aPrefix = a.name.toLowerCase().startsWith(q) || a.id.toLowerCase().startsWith(q) ? 0 : 1;
		const bPrefix = b.name.toLowerCase().startsWith(q) || b.id.toLowerCase().startsWith(q) ? 0 : 1;
		if (aPrefix !== bPrefix) return aPrefix - bPrefix;
		return a.name.localeCompare(b.name, "ko");
	});
	return matches.slice(0, limit);
}

/**
 * 한글 이름 (또는 id slug) 으로 챔피언 아이콘 URL.
 * 픽/밴 표시용.
 */
export function getChampionIconUrlByName(name: string): string {
	const champ = findChampion(name);
	if (!champ) return "";
	return `${BASE_URL}/cdn/${version}/img/champion/${champ.image.full}`;
}

/**
 * Get summoner spell name by numeric key.
 * e.g. 4 → "점멸"
 */
export function getSummonerSpellName(spellKey: number): string {
	return spellByKey.get(String(spellKey)) ?? `Unknown(${spellKey})`;
}

/**
 * Get item name by numeric ID.
 * e.g. 1001 → "장화"
 */
export function getItemName(itemId: number): string {
	if (itemId === 0) return "-";
	return itemById.get(String(itemId)) ?? `Unknown(${itemId})`;
}

/**
 * Get profile icon image URL by icon ID.
 */
export function getProfileIconUrl(iconId: number): string {
	const filename = profileIconById.get(iconId);
	if (!filename) return "";
	return `${BASE_URL}/cdn/${version}/img/profileicon/${filename}`;
}

/**
 * Get current Data Dragon version.
 */
export function getVersion(): string {
	return version;
}
