import { AppShell } from "./app/AppShell.js";
import { useActivitySession } from "./app/useActivitySession.js";
import { PermsProvider } from "./state/perms.js";

export function App() {
	return (
		<PermsProvider>
			<AppInner />
		</PermsProvider>
	);
}

function AppInner() {
	const session = useActivitySession();

	if (session.status === "error") {
		return (
			<div className="hero min-h-screen bg-base-200">
				<div className="hero-content text-center">
					<div className="max-w-2xl">
						<h1 className="text-3xl font-bold text-error">Activity 초기화 실패</h1>
						<pre className="mt-6 text-left text-xs bg-base-300 p-4 rounded-lg overflow-auto">
							{session.error}
						</pre>
					</div>
				</div>
			</div>
		);
	}

	if (session.status === "loading") {
		return (
			<div className="hero min-h-screen bg-base-200">
				<div className="hero-content text-center">
					<span className="loading loading-spinner loading-lg" />
					<p className="ml-4 text-base-content/70">Activity 인증 중…</p>
				</div>
			</div>
		);
	}

	return <AppShell user={session.user} />;
}
