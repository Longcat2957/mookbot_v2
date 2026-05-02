import { useEffect, useState } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { HelpModal } from "./components/HelpModal.js";
import { type StageKey, Steps } from "./components/Steps.js";
import { SystemDot } from "./components/SystemDot.js";
import { Toaster } from "./components/Toaster.js";
import { EntryEditing } from "./screens/EntryEditing.js";
import { Leaderboard } from "./screens/Leaderboard.js";
import { MiniGame } from "./screens/MiniGame.js";
import { PickBan } from "./screens/PickBan.js";
import { Profile } from "./screens/Profile.js";
import { RecruitmentList } from "./screens/RecruitmentList.js";
import { SeriesResult } from "./screens/SeriesResult.js";
import { type AuthedUser, initSdk } from "./sdk/client.js";
import { PermsProvider, usePerms } from "./state/perms.js";

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
	const [profileUserId, setProfileUserId] = useState<string | null>(null);
	const [profileBackTo, setProfileBackTo] = useState<StageKey>("LIST");
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
						<pre className="mt-6 text-left text-xs bg-base-300 p-4 rounded-lg overflow-auto">{error}</pre>
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
		setProfileUserId(null);
	};

	// 프로필 진입 — 어디서 왔는지 (backTo) 기억해 뒤로 가기 routing.
	const openProfile = (uid: string) => {
		setProfileBackTo(stage === "PROFILE" ? profileBackTo : stage);
		setProfileUserId(uid);
		setStage("PROFILE");
	};

	const goBackFromProfile = () => {
		setStage(profileBackTo);
		setProfileUserId(null);
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
					<span className="tooltip tooltip-bottom" data-tip="리더보드">
						<button
							type="button"
							className={`btn btn-sm btn-ghost btn-circle ${stage === "LEADERBOARD" ? "btn-active" : ""}`}
							onClick={() => setStage(stage === "LEADERBOARD" ? "LIST" : "LEADERBOARD")}
							aria-label="리더보드 열기"
							aria-pressed={stage === "LEADERBOARD"}
						>
							🏆
						</button>
					</span>
					<span className="tooltip tooltip-bottom" data-tip="미니게임 / 보조 도구">
						<button
							type="button"
							className={`btn btn-sm btn-ghost btn-circle ${stage === "MINIGAME" ? "btn-active" : ""}`}
							onClick={() => setStage(stage === "MINIGAME" ? "LIST" : "MINIGAME")}
							aria-label="도구 열기"
							aria-pressed={stage === "MINIGAME"}
						>
							🎲
						</button>
					</span>
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
							<span className={`badge badge-sm ${perms.canEdit ? "badge-success" : "badge-ghost"}`}>
								{perms.canEdit ? "✏️ 운영자" : "👁 읽기 전용"}
							</span>
						</span>
					)}
					<div className="dropdown dropdown-end">
						<div tabIndex={0} role="button" className="btn btn-ghost btn-sm">
							{user.username}
						</div>
						<ul
							tabIndex={0}
							className="dropdown-content menu bg-base-100 rounded-box z-30 w-44 p-2 shadow-lg border border-base-300 mt-1"
						>
							<li>
								<button type="button" onClick={() => openProfile(user.id)}>
									📇 내 프로필
								</button>
							</li>
						</ul>
					</div>
				</div>
			</div>

			{/* 진행 단계 표시 — 시리즈 라이프사이클 stage 일 때만 (도구/리더보드/프로필 제외) */}
			{stage !== "MINIGAME" && stage !== "LEADERBOARD" && stage !== "PROFILE" && (
				<div className="bg-base-200/40 border-b border-base-300">
					<div className="max-w-screen-xl mx-auto py-2 px-4">
						<Steps current={stage} />
					</div>
				</div>
			)}

			<main className="max-w-screen-xl mx-auto p-3 lg:p-4">
				{stage === "LIST" && (
					<ErrorBoundary key="list" label="대시보드" onReset={goHome}>
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
					</ErrorBoundary>
				)}
				{stage === "ENTRY_EDITING" && (
					<ErrorBoundary key={`entry-${recruitmentId}`} label="엔트리 수정" onReset={goHome}>
						<EntryEditing
							recruitmentId={recruitmentId}
							onSubmit={(sId) => {
								setSeriesId(sId);
								setRecruitmentId(null);
								setStage("IN_GAME");
							}}
						/>
					</ErrorBoundary>
				)}
				{stage === "IN_GAME" && (
					<ErrorBoundary key={`pickban-${seriesId}`} label="픽 / 밴" onReset={goHome}>
						<PickBan seriesId={seriesId} onBack={goHome} onSelectUser={openProfile} />
					</ErrorBoundary>
				)}
				{stage === "COMPLETED" && (
					<ErrorBoundary key={`result-${seriesId}`} label="시리즈 결과" onReset={goHome}>
						<SeriesResult seriesId={seriesId} onBack={goHome} onSelectUser={openProfile} />
					</ErrorBoundary>
				)}
				{stage === "MINIGAME" && (
					<ErrorBoundary key="minigame" label="도구" onReset={goHome}>
						<MiniGame onBack={goHome} />
					</ErrorBoundary>
				)}
				{stage === "LEADERBOARD" && (
					<ErrorBoundary key="leaderboard" label="리더보드" onReset={goHome}>
						<Leaderboard onBack={goHome} onSelectUser={openProfile} />
					</ErrorBoundary>
				)}
				{stage === "PROFILE" && profileUserId && (
					<ErrorBoundary key={`profile-${profileUserId}`} label="프로필" onReset={goHome}>
						<Profile
							userId={profileUserId}
							onBack={goBackFromProfile}
							onSelectSeries={(sid) => {
								setSeriesId(sid);
								setRecruitmentId(null);
								setProfileUserId(null);
								setStage("COMPLETED");
							}}
						/>
					</ErrorBoundary>
				)}
			</main>
			<Toaster />
			<HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
		</div>
	);
}
