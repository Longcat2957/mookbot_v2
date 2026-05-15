import { DiscordSDK } from "@discord/embedded-app-sdk";

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined;

export const sdk = CLIENT_ID ? new DiscordSDK(CLIENT_ID) : null;

export interface AuthedUser {
	id: string;
	username: string;
}

export async function initSdk(): Promise<{ user: AuthedUser }> {
	const clientId = CLIENT_ID;
	if (!sdk || !clientId) throw new Error("VITE_DISCORD_CLIENT_ID not set");

	const stage = (_s: string): void => {};

	stage("ready");
	await sdk.ready();

	stage("authorize");
	const { code } = await sdk.commands.authorize({
		client_id: clientId,
		response_type: "code",
		state: "",
		prompt: "none",
		scope: ["identify"],
	});

	stage("token-exchange");
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

	stage("authenticate");
	const auth = await sdk.commands.authenticate({ access_token });
	if (!auth) throw new Error("authenticate returned null");

	stage("session");
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

	stage("done");
	return { user: { id: auth.user.id, username: auth.user.username } };
}
