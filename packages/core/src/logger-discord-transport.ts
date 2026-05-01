// pino transport (worker thread) — error/fatal 로그를 Discord webhook 으로 push.
// 자기 자신의 에러를 절대 pino 로 다시 로깅하지 않는다 (무한 루프 방지).

import build from "pino-abstract-transport";

export interface DiscordTransportOptions {
	webhookUrl: string;
	service?: string;
	dedupeWindowMs?: number;
	bucketCapacity?: number;
	bucketRefillMs?: number;
	maxQueueSize?: number;
}

interface PinoLogObject {
	level: number;
	time: number;
	msg?: string;
	err?: { message?: string; stack?: string; name?: string };
	app?: string;
	hostname?: string;
	pid?: number;
	[k: string]: unknown;
}

const LEVEL_LABEL: Record<number, string> = {
	60: "FATAL",
	50: "ERROR",
	40: "WARN",
};

function formatStack(stack: string, maxChars = 3500): string {
	if (stack.length <= maxChars) return stack;
	const lines = stack.split("\n");
	const head = lines.slice(0, 30);
	const tail = lines.slice(-10);
	const omitted = Math.max(0, lines.length - head.length - tail.length);
	return [...head, `… (${omitted} lines truncated) …`, ...tail].join("\n");
}

const STRIP_KEYS = new Set([
	"level",
	"time",
	"msg",
	"err",
	"app",
	"hostname",
	"pid",
	"v",
]);

interface DiscordEmbed {
	title: string;
	description: string;
	color: number;
	fields: Array<{ name: string; value: string; inline?: boolean }>;
}

function formatEmbed(obj: PinoLogObject, service: string): DiscordEmbed {
	const isFatal = obj.level >= 60;
	const label = LEVEL_LABEL[obj.level] ?? "LOG";
	const color = isFatal ? 0xb71c1c : obj.level >= 50 ? 0xe65100 : 0x999999;

	const ctx: Record<string, unknown> = {};
	for (const k of Object.keys(obj)) {
		if (!STRIP_KEYS.has(k)) ctx[k] = obj[k];
	}

	const fields: DiscordEmbed["fields"] = [
		{ name: "time", value: new Date(obj.time).toISOString(), inline: true },
		{ name: "host", value: String(obj.hostname ?? "?"), inline: true },
	];

	if (obj.err) {
		const errLine = `${obj.err.name ?? "Error"}: ${obj.err.message ?? "(no message)"}`;
		fields.push({ name: "error", value: "```\n" + errLine.slice(0, 1000) + "\n```" });
		if (obj.err.stack) {
			fields.push({
				name: "stack",
				value: "```\n" + formatStack(obj.err.stack) + "\n```",
			});
		}
	}

	if (Object.keys(ctx).length > 0) {
		let ctxStr = JSON.stringify(ctx, null, 2);
		if (ctxStr.length > 800) ctxStr = ctxStr.slice(0, 800) + "\n…(truncated)";
		fields.push({ name: "context", value: "```json\n" + ctxStr + "\n```" });
	}

	return {
		title: `${isFatal ? "🚨" : "🔴"} ${label} | ${service}`,
		description: (obj.msg ?? "(no message)").slice(0, 2000),
		color,
		fields,
	};
}

export default async function discordTransport(opts: DiscordTransportOptions) {
	const {
		webhookUrl,
		service = "app",
		dedupeWindowMs = 5 * 60 * 1000,
		bucketCapacity = 6,
		bucketRefillMs = 10_000,
		maxQueueSize = 200,
	} = opts;

	const dedupe = new Map<string, number>();
	let tokens = bucketCapacity;
	const queue: PinoLogObject[] = [];
	let flushing = false;

	async function flush(): Promise<void> {
		if (flushing) return;
		flushing = true;
		try {
			while (tokens > 0 && queue.length > 0) {
				const obj = queue.shift();
				if (!obj) break;
				tokens--;
				const embed = formatEmbed(obj, service);
				try {
					const res = await fetch(webhookUrl, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ embeds: [embed] }),
					});
					if (!res.ok) {
						process.stderr.write(
							`[discord-transport] webhook POST ${res.status}\n`,
						);
					}
				} catch (e) {
					const msg = e instanceof Error ? e.message : String(e);
					process.stderr.write(`[discord-transport] webhook fetch failed: ${msg}\n`);
				}
			}
		} finally {
			flushing = false;
		}
	}

	const refill = setInterval(() => {
		tokens = Math.min(bucketCapacity, tokens + 1);
		void flush();
	}, bucketRefillMs);
	refill.unref();

	return build(
		async (source) => {
			for await (const obj of source as AsyncIterable<PinoLogObject>) {
				const key = `${obj.level}:${obj.msg ?? ""}:${obj.err?.message ?? ""}`;
				const now = Date.now();
				const last = dedupe.get(key);
				if (last && now - last < dedupeWindowMs) continue;
				dedupe.set(key, now);
				if (dedupe.size > 1000) {
					for (const [k, t] of dedupe) {
						if (now - t > dedupeWindowMs) dedupe.delete(k);
					}
				}

				if (queue.length >= maxQueueSize) {
					process.stderr.write("[discord-transport] queue full, dropping log\n");
					continue;
				}
				queue.push(obj);
				void flush();
			}
		},
		{
			async close() {
				clearInterval(refill);
				const start = Date.now();
				while (queue.length > 0 && Date.now() - start < 2000) {
					tokens = Math.max(tokens, 1);
					await flush();
					await new Promise((r) => setTimeout(r, 100));
				}
			},
		},
	);
}
