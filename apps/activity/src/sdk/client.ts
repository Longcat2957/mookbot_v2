import { DiscordSDK } from "@discord/embedded-app-sdk";

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined;

export const sdk = CLIENT_ID ? new DiscordSDK(CLIENT_ID) : null;

export interface AuthedUser {
	id: string;
	username: string;
}

const SDK_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = window.setTimeout(() => reject(new Error(`${label} timeout`)), SDK_TIMEOUT_MS);
		promise.then(resolve, reject).finally(() => window.clearTimeout(timer));
	});
}

async function getExistingSessionUser(): Promise<AuthedUser | null> {
	const res = await fetch("/api/me", { credentials: "include" });
	if (!res.ok) return null;
	const me = (await res.json()) as { discordId?: string };
	if (!me.discordId) return null;
	return { id: me.discordId, username: `User ${me.discordId.slice(-4)}` };
}

async function authenticateWithDiscordSdk(clientId: string): Promise<{ user: AuthedUser }> {
	if (!sdk) throw new Error("Discord SDK not initialized");

	await withTimeout(sdk.ready(), "Discord SDK ready");

	const { code } = await withTimeout(
		sdk.commands.authorize({
			client_id: clientId,
			response_type: "code",
			state: "",
			prompt: "none",
			scope: ["identify"],
		}),
		"Discord authorize",
	);

	const tokenRes = await fetch("/api/token", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ code }),
	});
	if (!tokenRes.ok) {
		const text = await tokenRes.text().catch(() => "");
		throw new Error(`token exchange ${tokenRes.status}: ${text}`);
	}
	const { access_token } = (await tokenRes.json()) as { access_token: string };

	const auth = await withTimeout(
		sdk.commands.authenticate({ access_token }),
		"Discord authenticate",
	);
	if (!auth) throw new Error("authenticate returned null");

	const sessRes = await fetch("/api/session", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ access_token }),
		credentials: "include",
	});
	if (!sessRes.ok) {
		const text = await sessRes.text().catch(() => "");
		throw new Error(`session ${sessRes.status}: ${text}`);
	}

	return { user: { id: auth.user.id, username: auth.user.username } };
}

export async function initSdk(): Promise<{ user: AuthedUser }> {
	const clientId = CLIENT_ID;
	if (!sdk || !clientId) throw new Error("VITE_DISCORD_CLIENT_ID not set");

	const existingSession = getExistingSessionUser().catch(() => null);
	try {
		return await authenticateWithDiscordSdk(clientId);
	} catch (err) {
		const user = await existingSession;
		if (user) return { user };
		throw err;
	}
}
