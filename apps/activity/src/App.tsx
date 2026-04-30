import { useEffect, useState } from "react";
import { initSdk, type AuthedUser } from "./sdk/client.js";
import { Steps, type StageKey } from "./components/Steps.js";
import { SystemDot } from "./components/SystemDot.js";
import { Toaster } from "./components/Toaster.js";
import { HelpModal } from "./components/HelpModal.js";
import { PermsProvider, usePerms } from "./state/perms.js";
import { RecruitmentList } from "./screens/RecruitmentList.js";
import { EntryEditing } from "./screens/EntryEditing.js";
import { PickBan } from "./screens/PickBan.js";
import { SeriesResult } from "./screens/SeriesResult.js";

function describeError(err: unknown): string {
	if (err instanceof Error) return err.stack ?? err.message;
	if (typeof err === "string") return err;
	try {
		return JSON.stringify(err, null, 2);
	} catch {
		return String(err);
	}
}

export function App() {
	return (
		<PermsProvider>
			<AppInner />
		</PermsProvider>
	);
}

function AppInner() {
	const [user, setUser] = useState<AuthedUser | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [stage, setStage] = useState<StageKey>("LIST");
	const [recruitmentId, setRecruitmentId] = useState<number | null>(null);
	const [seriesId, setSeriesId] = useState<number | null>(null);
	const [helpOpen, setHelpOpen] = useState(false);

	// "?" 단축키 — 도움말 토글. design_upgrade.md §4.5
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "?") return;
			const tag = (document.activeElement as HTMLElement | null)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return;
			e.preventDefault();
			setHelpOpen((v) => !v);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);
	const perms = usePerms();

	useEffect(() => {
		initSdk()
			.then(({ user }) => setUser(user))
			.catch((err: unknown) => {
				console.error("[mookbot] initSdk failed", err);
				setError(describeError(err));
			});
	}, []);

	if (error) {
		return (
			<div className="hero min-h-screen bg-base-200">
				<div className="hero-content text-center">
					<div className="max-w-2xl">
						<h1 className="text-3xl font-bold text-error">Activity 초기화 실패</h1>
						<pre className="mt-6 text-left text-xs bg-base-300 p-4 rounded-lg overflow-auto">
							{error}
						</pre>
					</div>
				</div>
			</div>
		);
	}

	if (!user) {
		return (
			<div className="hero min-h-screen bg-base-200">
				<div className="hero-content text-center">
					<span className="loading loading-spinner loading-lg" />
					<p className="ml-4 text-base-content/70">Activity 인증 중…</p>
				</div>
			</div>
		);
	}

	const goHome = () => {
		setStage("LIST");
		setRecruitmentId(null);
		setSeriesId(null);
	};

	return (
		<div className="min-h-screen bg-base-100">
			<div className="navbar bg-base-200 shadow-sm">
				<div className="flex-1 px-4">
					<button
						type="button"
						className="text-xl font-bold hover:text-primary cursor-pointer"
						onClick={goHome}
					>
						mookbot
					</button>
					{recruitmentId !== null && (
						<span className="ml-3 badge badge-ghost badge-sm">모집 #{recruitmentId}</span>
					)}
					{seriesId !== null && (
						<span className="ml-3 badge badge-ghost badge-sm">시리즈 #{seriesId}</span>
					)}
				</div>
				<div className="flex-none px-4 flex items-center gap-2">
					<SystemDot />
					<span className="tooltip tooltip-bottom" data-tip="도움말 (?)">
						<button
							type="button"
							className="btn btn-sm btn-ghost btn-circle"
							onClick={() => setHelpOpen(true)}
							aria-label="도움말 열기"
						>
							?
						</button>
					</span>
					{perms.operatorRoleConfigured && (
						<span
							className="tooltip tooltip-bottom"
							data-tip={
								perms.canEdit
									? "운영자 권한 — 엔트리/픽밴/결과 입력 가능"
									: "읽기 전용 — 운영자 role 이 필요합니다"
							}
						>
							<span
								className={`badge badge-sm ${perms.canEdit ? "badge-success" : "badge-ghost"}`}
							>
								{perms.canEdit ? "✏️ 운영자" : "👁 읽기 전용"}
							</span>
						</span>
					)}
					<div className="dropdown dropdown-end">
						<div tabIndex={0} role="button" className="btn btn-ghost btn-sm">
							{user.username}
						</div>
					</div>
				</div>
			</div>

			{/* 진행 단계 표시 */}
			<div className="bg-base-200/40 border-b border-base-300">
				<div className="max-w-screen-xl mx-auto py-2 px-4">
					<Steps current={stage} />
				</div>
			</div>

			<main className="max-w-screen-xl mx-auto p-3 lg:p-4">
				{stage === "LIST" && (
					<RecruitmentList
						onSelectRecruitment={(id) => {
							setRecruitmentId(id);
							setSeriesId(null);
							setStage("ENTRY_EDITING");
						}}
						onSelectSeries={(id) => {
							setSeriesId(id);
							setRecruitmentId(null);
							setStage("IN_GAME");
						}}
						onSelectCompletedSeries={(id) => {
							setSeriesId(id);
							setRecruitmentId(null);
							setStage("COMPLETED");
						}}
					/>
				)}
				{stage === "ENTRY_EDITING" && (
					<EntryEditing
						recruitmentId={recruitmentId}
						onSubmit={(sId) => {
							setSeriesId(sId);
							setRecruitmentId(null);
							setStage("IN_GAME");
						}}
					/>
				)}
				{stage === "IN_GAME" && (
					<PickBan
						seriesId={seriesId}
						onBack={goHome}
					/>
				)}
				{stage === "COMPLETED" && (
					<SeriesResult seriesId={seriesId} onBack={goHome} />
				)}
			</main>
			<Toaster />
			<HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
		</div>
	);
}
