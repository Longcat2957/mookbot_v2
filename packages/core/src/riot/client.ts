import type { Rank, Tier } from "./types.js";

// ============================================================
// Region Configuration
// ============================================================

const PLATFORM_HOSTS = {
	KR: "kr.api.riotgames.com",
	BR1: "br1.api.riotgames.com",
	EUN1: "eun1.api.riotgames.com",
	EUW1: "euw1.api.riotgames.com",
	JP1: "jp1.api.riotgames.com",
	LA1: "la1.api.riotgames.com",
	LA2: "la2.api.riotgames.com",
	NA1: "na1.api.riotgames.com",
	OC1: "oc1.api.riotgames.com",
	TR1: "tr1.api.riotgames.com",
	RU: "ru.api.riotgames.com",
	PH2: "ph2.api.riotgames.com",
	SG2: "sg2.api.riotgames.com",
	TH2: "th2.api.riotgames.com",
	TW2: "tw2.api.riotgames.com",
	VN2: "vn2.api.riotgames.com",
} as const;

const REGIONAL_HOSTS = {
	AMERICAS: "americas.api.riotgames.com",
	ASIA: "asia.api.riotgames.com",
	EUROPE: "europe.api.riotgames.com",
	SEA: "sea.api.riotgames.com",
} as const;

export type Platform = keyof typeof PLATFORM_HOSTS;
export type Region = keyof typeof REGIONAL_HOSTS;

// ============================================================
// Cache
// ============================================================

interface CacheEntry<T> {
	data: T;
	expiry: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

function getCache<T>(key: string): T | undefined {
	const entry = cache.get(key);
	if (!entry) return undefined;
	if (Date.now() > entry.expiry) {
		cache.delete(key);
		return undefined;
	}
	return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlMs: number): void {
	cache.set(key, { data, expiry: Date.now() + ttlMs });
}

/**
 * Riot API 응답 캐시 전체 비우기 — 테스트에서 mock fetch 결과 격리용.
 * 운영 코드 경로에서는 호출하지 않는다.
 */
export function __clearRiotCacheForTest(): void {
	cache.clear();
	inFlight.clear();
}

// ============================================================
// Rate Limit Tracker
// ============================================================

let lastRequestTime = 0;
let requestQueue: Promise<void> = Promise.resolve();
const MIN_INTERVAL_MS = 50; // ~20 req/s for production key

async function waitForRateLimit(): Promise<void> {
	const previous = requestQueue;
	let release!: () => void;
	requestQueue = new Promise<void>((resolve) => {
		release = resolve;
	});
	await previous;
	try {
		const now = Date.now();
		const elapsed = now - lastRequestTime;
		if (elapsed < MIN_INTERVAL_MS) {
			await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
		}
		lastRequestTime = Date.now();
	} finally {
		release();
	}
}

// ============================================================
// RiotApiClient
// ============================================================

export class RiotApiClient {
	private readonly apiKey: string;

	constructor(apiKey?: string) {
		this.apiKey = apiKey ?? process.env.RIOT_API_KEY ?? "";
		if (!this.apiKey) {
			throw new Error("RIOT_API_KEY is not set");
		}
	}

	// --- Platform endpoint (kr, na1, etc.) ---
	private platformUrl(platform: Platform, path: string): string {
		return `https://${PLATFORM_HOSTS[platform]}${path}`;
	}

	// --- Regional endpoint (asia, americas, etc.) ---
	private regionUrl(region: Region, path: string): string {
		return `https://${REGIONAL_HOSTS[region]}${path}`;
	}

	// --- Core request method ---
	private async request<T>(url: string, ttlMs: number): Promise<T> {
		// Check cache first
		const cached = getCache<T>(url);
		if (cached !== undefined) return cached;
		const pending = inFlight.get(url);
		if (pending) return pending as Promise<T>;

		const request = this.requestUncached<T>(url, ttlMs);
		inFlight.set(url, request);
		try {
			return await request;
		} finally {
			inFlight.delete(url);
		}
	}

	private async requestUncached<T>(url: string, ttlMs: number): Promise<T> {
		// Rate limit
		await waitForRateLimit();

		const res = await fetch(url, {
			headers: { "X-Riot-Token": this.apiKey },
		});

		if (res.status === 429) {
			const retryAfter = Number(res.headers.get("Retry-After") ?? "1") * 1000;
			console.warn(`Rate limited. Retrying after ${retryAfter}ms...`);
			await new Promise((resolve) => setTimeout(resolve, retryAfter));
			return this.requestUncached<T>(url, ttlMs);
		}

		if (!res.ok) {
			const body = await res.text().catch(() => "");
			throw new Error(`Riot API error ${res.status}: ${res.statusText} — ${body} [${url}]`);
		}

		const data = (await res.json()) as T;
		setCache(url, data, ttlMs);
		return data;
	}

	// --- Public typed request helpers ---

	async getAccountByRiotId(gameName: string, tagLine: string, region: Region = "ASIA") {
		const path = `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
		return this.request<import("./types.js").AccountDto>(this.regionUrl(region, path), 10 * 60_000);
	}

	// Riot ID 변경 (game_name / tag_line) 추적용 — puuid 는 영구 ID.
	async getAccountByPuuid(puuid: string, region: Region = "ASIA") {
		const path = `/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`;
		return this.request<import("./types.js").AccountDto>(this.regionUrl(region, path), 10 * 60_000);
	}

	async getSummonerByPuuid(puuid: string, platform: Platform = "KR") {
		const path = `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`;
		return this.request<import("./types.js").SummonerDto>(
			this.platformUrl(platform, path),
			10 * 60_000,
		);
	}

	async getLeagueEntries(puuid: string, platform: Platform = "KR") {
		const path = `/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`;
		return this.request<import("./types.js").LeagueEntryDto[]>(
			this.platformUrl(platform, path),
			5 * 60_000,
		);
	}

	async getChampionMasteries(puuid: string, platform: Platform = "KR") {
		const path = `/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(puuid)}`;
		return this.request<import("./types.js").ChampionMasteryDto[]>(
			this.platformUrl(platform, path),
			10 * 60_000,
		);
	}

	async getMatchIds(
		puuid: string,
		count: number = 20,
		region: Region = "ASIA",
		options: { queue?: number; type?: string } = {},
	) {
		const params = new URLSearchParams({ count: String(count) });
		if (options.queue != null) params.set("queue", String(options.queue));
		if (options.type) params.set("type", options.type);
		const path = `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?${params.toString()}`;
		return this.request<string[]>(this.regionUrl(region, path), 3 * 60_000);
	}

	async getMatch(matchId: string, region: Region = "ASIA") {
		const path = `/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
		return this.request<import("./types.js").MatchDto>(this.regionUrl(region, path), 3 * 60_000);
	}

	async getCurrentGame(puuid: string, platform: Platform = "KR") {
		const path = `/lol/spectator/v5/active-games/by-summoner/${encodeURIComponent(puuid)}`;
		// 짧은 캐시 (15s) — 게임 진행 중에는 자주 호출
		return this.request<import("./types.js").CurrentGameInfoDto>(
			this.platformUrl(platform, path),
			15_000,
		);
	}
}

// --- Singleton instance (lazy, so dotenv can load first) ---
let _riotClient: RiotApiClient | undefined;

export function getRiotClient(): RiotApiClient {
	if (!_riotClient) {
		_riotClient = new RiotApiClient();
	}
	return _riotClient;
}

// ============================================================
// Tier/Rank display helpers
// ============================================================

const TIER_ORDER: Record<Tier, number> = {
	IRON: 0,
	BRONZE: 1,
	SILVER: 2,
	GOLD: 3,
	PLATINUM: 4,
	EMERALD: 5,
	DIAMOND: 6,
	MASTER: 7,
	GRANDMASTER: 8,
	CHALLENGER: 9,
};

const RANK_ORDER: Record<Rank, number> = {
	IV: 0,
	III: 1,
	II: 2,
	I: 3,
};

export function tierValue(tier: Tier, rank: Rank, lp: number): number {
	return TIER_ORDER[tier] * 400 + RANK_ORDER[rank] * 100 + lp;
}

export function formatTier(tier: Tier, rank: Rank, lp: number): string {
	return `${tier} ${rank} ${lp}LP`;
}
