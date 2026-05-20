import { db } from "@mookbot/core";
import type { Platform, Region } from "@mookbot/core/riot";
import { generateLolScreeningReport, type ScreeningReport } from "@mookbot/core/screening";
import type { FastifyInstance } from "fastify";
import { requireEditor } from "./_helpers.js";

const CACHE_TTL_MS = 24 * 60 * 60_000;
const REGIONS = new Set<Region>(["AMERICAS", "ASIA", "EUROPE", "SEA"]);
const PLATFORMS = new Set<Platform>([
	"KR",
	"BR1",
	"EUN1",
	"EUW1",
	"JP1",
	"LA1",
	"LA2",
	"NA1",
	"OC1",
	"TR1",
	"RU",
	"PH2",
	"SG2",
	"TH2",
	"TW2",
	"VN2",
]);

interface CachedReport {
	fetchedAt: number;
	report: ScreeningReport;
}

export async function registerScreeningRoutes(app: FastifyInstance): Promise<void> {
	app.get<{
		Params: { region: string; gameName: string; tagLine: string };
		Querystring: { platform?: string; sample?: string; refresh?: string };
	}>("/api/screening/lol/:region/:gameName/:tagLine", async (req, reply) => {
		const operatorId = await requireEditor(req, reply);
		if (!operatorId) return;

		const region = parseRegion(req.params.region);
		const platform = parsePlatform(req.query.platform ?? "KR");
		if (!region) return reply.code(400).send({ error: "invalid region" });
		if (!platform) return reply.code(400).send({ error: "invalid platform" });

		const gameName = req.params.gameName.trim();
		const tagLine = req.params.tagLine.trim();
		if (!gameName || !tagLine) return reply.code(400).send({ error: "invalid riot id" });

		const sample = parseSample(req.query.sample);
		const result = await getOrGenerateReport({
			gameName,
			tagLine,
			region,
			platform,
			sample,
			refresh: req.query.refresh === "1" || req.query.refresh === "true",
		});
		await db.recordAudit({
			operatorId,
			action: "screening.report.viewed",
			targetType: "riot_id",
			targetId: `${gameName}#${tagLine}`,
			payload: { region, platform, sample, cached: result.cached, stale: result.stale },
		});
		return result;
	});

	app.get<{
		Params: { id: string };
		Querystring: { region?: string; platform?: string; sample?: string; refresh?: string };
	}>("/api/users/:id/screening-report", async (req, reply) => {
		const operatorId = await requireEditor(req, reply);
		if (!operatorId) return;

		const user = await db.getUser(req.params.id);
		if (!user) return reply.code(404).send({ error: "user not found" });
		const account = await db.getMainRiotAccount(req.params.id);
		if (!account) return reply.code(404).send({ error: "main riot account not found" });

		const region = parseRegion(req.query.region ?? "ASIA");
		const platform = parsePlatform(req.query.platform ?? "KR");
		if (!region) return reply.code(400).send({ error: "invalid region" });
		if (!platform) return reply.code(400).send({ error: "invalid platform" });

		const sample = parseSample(req.query.sample);
		const result = await getOrGenerateReport({
			gameName: account.game_name,
			tagLine: account.tag_line,
			region,
			platform,
			sample,
			refresh: req.query.refresh === "1" || req.query.refresh === "true",
		});
		await db.recordAudit({
			operatorId,
			action: "screening.report.viewed",
			targetType: "user",
			targetId: req.params.id,
			payload: {
				riotId: `${account.game_name}#${account.tag_line}`,
				region,
				platform,
				sample,
				cached: result.cached,
				stale: result.stale,
			},
		});
		return result;
	});
}

async function getOrGenerateReport(input: {
	gameName: string;
	tagLine: string;
	region: Region;
	platform: Platform;
	sample: number;
	refresh: boolean;
}): Promise<{ cached: boolean; stale: boolean; fetchedAt: number; report: ScreeningReport }> {
	const key = cacheKey(input);
	const cached = await readCachedReport(key);
	if (cached && !input.refresh && cached.fetchedAt + CACHE_TTL_MS > Date.now()) {
		return { cached: true, stale: false, fetchedAt: cached.fetchedAt, report: cached.report };
	}

	try {
		const report = await generateLolScreeningReport(input);
		const fetchedAt = Date.now();
		await db.setKv(key, JSON.stringify({ fetchedAt, report }), "screening-report");
		return { cached: false, stale: false, fetchedAt, report };
	} catch (error) {
		if (cached) {
			return { cached: true, stale: true, fetchedAt: cached.fetchedAt, report: cached.report };
		}
		throw error;
	}
}

async function readCachedReport(key: string): Promise<CachedReport | null> {
	const raw = await db.getKv(key);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as CachedReport;
		if (!parsed || typeof parsed.fetchedAt !== "number" || !parsed.report) return null;
		return parsed;
	} catch {
		return null;
	}
}

function cacheKey(input: {
	gameName: string;
	tagLine: string;
	region: Region;
	platform: Platform;
	sample: number;
}): string {
	const riotId = `${input.gameName}#${input.tagLine}`.toLocaleLowerCase("ko-KR");
	return `screening:lol:${input.region}:${input.platform}:${input.sample}:${encodeURIComponent(riotId)}`;
}

function parseRegion(value: string): Region | null {
	const normalized = value.toUpperCase();
	return REGIONS.has(normalized as Region) ? (normalized as Region) : null;
}

function parsePlatform(value: string): Platform | null {
	const normalized = value.toUpperCase();
	return PLATFORMS.has(normalized as Platform) ? (normalized as Platform) : null;
}

function parseSample(value: string | undefined): number {
	const sample = Number(value ?? 50);
	if (!Number.isFinite(sample)) return 50;
	return Math.max(1, Math.min(50, Math.trunc(sample)));
}
