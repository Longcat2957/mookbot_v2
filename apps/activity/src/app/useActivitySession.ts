import { useEffect, useState } from "react";
import { type AuthedUser, initSdk } from "../sdk/client.js";

function describeError(err: unknown): string {
	if (err instanceof Error) return err.stack ?? err.message;
	if (typeof err === "string") return err;
	try {
		return JSON.stringify(err, null, 2);
	} catch {
		return String(err);
	}
}

export type ActivitySession =
	| { status: "loading"; user: null; error: null }
	| { status: "ready"; user: AuthedUser; error: null }
	| { status: "error"; user: null; error: string };

export function useActivitySession(): ActivitySession {
	const [session, setSession] = useState<ActivitySession>({
		status: "loading",
		user: null,
		error: null,
	});

	useEffect(() => {
		let cancelled = false;

		initSdk()
			.then(({ user }) => {
				if (!cancelled) setSession({ status: "ready", user, error: null });
			})
			.catch((err: unknown) => {
				console.error("[mookbot] initSdk failed", err);
				if (!cancelled) {
					setSession({ status: "error", user: null, error: describeError(err) });
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return session;
}
