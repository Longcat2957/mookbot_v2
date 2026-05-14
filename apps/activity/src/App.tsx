import { useEffect, useState } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { HelpModal } from "./components/HelpModal.js";
import { PermsModal } from "./components/PermsModal.js";
import { SearchBar } from "./components/SearchBar.js";
import { type StageKey, Steps } from "./components/Steps.js";
import { SystemDot } from "./components/SystemDot.js";
import { Toaster } from "./components/Toaster.js";
import { AuctionBracket } from "./screens/Auction/AuctionBracket.js";
import { AuctionDraft } from "./screens/Auction/AuctionDraft.js";
import { AuctionResult } from "./screens/Auction/AuctionResult.js";
import { EntryEditing } from "./screens/EntryEditing.js";
import { Leaderboard } from "./screens/Leaderboard.js";
import { MiniGame } from "./screens/MiniGame.js";
import { MyRiotAccounts } from "./screens/MyRiotAccounts.js";
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

// 좌측 컨텍스트 — daisyUI breadcrumbs 로 현재 위치 시각화.
// 시리즈 단계 (IN_GAME / COMPLETED) 에서 모집↔시리즈 1:1 매핑 (v0.3.4 부터
// series.id == recruitment.id) 을 두 항목으로 같이 표시 — 사용자가 "모집 #5
// → 시리즈 #5" 가 같은 객체임을 자연 인지.
// 정적 표시 (clickable X) — 대시보드로 돌아가는 길은 좌측 monkey 로고가 담당.
function ContextChip({
	stage,
	recruitmentId,
	seriesId,
}: {
	stage: StageKey;
	recruitmentId: number | null;
	seriesId: number | null;
}) {
	if (stage === "LIST") return null;

	const items: string[] = (() => {
		switch (stage) {
			case "ENTRY_EDITING":
				// 시리즈는 엔트리 제출 시점에 INSERT — 이 단계엔 미존재. 모집만 표시.
				return recruitmentId !== null
					? [`📋 모집 #${recruitmentId}`, "엔트리 수정"]
					: ["📋 엔트리 수정"];
			case "IN_GAME":
				return seriesId !== null
					? [`📋 모집 #${seriesId}`, `🎮 시리즈 #${seriesId}`, "픽/밴"]
					: ["🎮 시리즈"];
			case "COMPLETED":
				return seriesId !== null
					? [`📋 모집 #${seriesId}`, `🎮 시리즈 #${seriesId}`, "✅ 종료"]
					: ["✅ 시리즈 종료"];
			case "PROFILE":
				return ["👤 프로필"];
			case "MY_RIOT_ACCOUNTS":
				return ["🔗 라이엇 계정 관리"];
			case "LEADERBOARD":
				return ["🏆 리더보드"];
			case "MINIGAME":
				return ["🎲 도구"];
			default:
				return [];
		}
	})();
	if (items.length === 0) return null;

	return (
		<div className="breadcrumbs text-xs font-medium max-w-full min-w-0 py-0">
			<ul>
				{items.map((item, i) => (
					<li
						key={item}
						className={i === items.length - 1 ? "text-base-content" : "text-base-content/55"}
					>
						<span className="truncate">{item}</span>
					</li>
				))}
			</ul>
		</div>
	);
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
	const [auctionRecruitmentId, setAuctionRecruitmentId] = useState<number | null>(null);
	const [auctionTournamentId, setAuctionTournamentId] = useState<number | null>(null);
	const [profileUserId, setProfileUserId] = useState<string | null>(null);
	const [profileBackTo, setProfileBackTo] = useState<StageKey>("LIST");
	const [helpOpen, setHelpOpen] = useState(false);
	const [permsOpen, setPermsOpen] = useState(false);
	const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

	// "?" 단축키 — 도움말 토글. design_upgrade.md §4.5
	// SoT: state/shortcuts.ts — HelpModal 이 표시하는 단축키 목록과 sync.
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
		setAuctionRecruitmentId(null);
		setAuctionTournamentId(null);
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
		<div className="min-h-screen bg-base-100 flex flex-col">
			<div className="navbar bg-base-200 shadow-sm border-b border-base-300">
				<div className="navbar-start gap-3 px-4 min-w-0">
					<button
						type="button"
						className="text-xl font-bold tracking-tight hover:text-primary cursor-pointer shrink-0 flex items-baseline gap-1.5"
						onClick={goHome}
					>
						<span>monkey</span>
						<span
							className="text-[10px] font-normal text-base-content/40 tabular-nums"
							title={`Activity 버전 ${__APP_VERSION__}`}
						>
							v{__APP_VERSION__}
						</span>
					</button>
					<ContextChip stage={stage} recruitmentId={recruitmentId} seriesId={seriesId} />
				</div>
				<div className="navbar-center hidden md:flex">
					<SearchBar onSelectUser={openProfile} />
				</div>
				<div className="navbar-end gap-1 sm:gap-2 px-2 sm:px-4">
					<button
						type="button"
						className="md:hidden btn btn-ghost btn-sm btn-circle"
						onClick={() => setMobileSearchOpen((v) => !v)}
						aria-label="검색 열기"
						aria-pressed={mobileSearchOpen}
					>
						🔍
					</button>
					<SystemDot />
					<details className="dropdown dropdown-end">
						<summary
							className="btn btn-ghost btn-sm gap-1.5 px-2 list-none after:content-none"
							aria-label="메뉴 열기"
						>
							<span
								className={`badge badge-xs ${perms.canEdit ? "badge-success" : "badge-ghost"}`}
								title={
									perms.canEdit
										? "운영자 권한 — 엔트리/픽밴/결과 입력 가능"
										: "읽기 전용 — BalanceTeam 역할이 필요합니다"
								}
							>
								{perms.canEdit ? "✏️" : "👁"}
							</span>
							<span className="font-medium truncate max-w-32">{user.username}</span>
							<span className="text-xs opacity-60">▾</span>
						</summary>
						<ul className="dropdown-content menu bg-base-100 rounded-box z-30 w-56 p-2 shadow-lg border border-base-300 mt-1">
							<li>
								<button
									type="button"
									className={stage === "PROFILE" && profileUserId === user.id ? "active" : ""}
									onClick={() => openProfile(user.id)}
								>
									<span className="text-base">📇</span>
									<span>내 프로필</span>
								</button>
							</li>
							<li className="menu-title pt-2">
								<span>둘러보기</span>
							</li>
							<li>
								<button
									type="button"
									className={stage === "LEADERBOARD" ? "active" : ""}
									onClick={() => setStage("LEADERBOARD")}
								>
									<span className="text-base">🏆</span>
									<span>리더보드</span>
								</button>
							</li>
							<li>
								<button
									type="button"
									className={stage === "MINIGAME" ? "active" : ""}
									onClick={() => setStage("MINIGAME")}
								>
									<span className="text-base">🎲</span>
									<span>도구 / 미니게임</span>
								</button>
							</li>
							<li>
								<button type="button" onClick={() => setHelpOpen(true)}>
									<span className="text-base">❓</span>
									<span>도움말</span>
									<kbd className="kbd kbd-xs ml-auto">?</kbd>
								</button>
							</li>
							<li>
								<button type="button" onClick={() => setPermsOpen(true)}>
									<span className="text-base">{perms.canEdit ? "✏️" : "👁"}</span>
									<span>내 권한 확인</span>
								</button>
							</li>
							<li className="menu-title pt-2">
								<span>설정</span>
							</li>
							<li>
								<label className="cursor-pointer flex items-center justify-between gap-2">
									<span className="flex items-center gap-2">
										<span className="text-base">🌓</span>
										<span>라이트 모드</span>
									</span>
									<input
										type="checkbox"
										value="light"
										className="toggle toggle-sm theme-controller"
										aria-label="라이트 모드 토글"
									/>
								</label>
							</li>
						</ul>
					</details>
				</div>
			</div>

			{/* 모바일 검색 펼침 — md 미만에서 navbar 의 🔍 버튼이 토글 */}
			{mobileSearchOpen && (
				<div className="md:hidden bg-base-200 border-b border-base-300 px-3 py-2">
					<SearchBar
						onSelectUser={(uid) => {
							setMobileSearchOpen(false);
							openProfile(uid);
						}}
					/>
				</div>
			)}

			{/* 진행 단계 표시 — 시리즈 라이프사이클 안 일 때만.
			    LIST(대시보드) / MINIGAME / LEADERBOARD / PROFILE 은 라이프사이클 밖이라 숨김. */}
			{(stage === "ENTRY_EDITING" || stage === "IN_GAME" || stage === "COMPLETED") && (
				<div className="bg-base-200/40 border-b border-base-300">
					<div className="max-w-screen-xl mx-auto py-2 px-4">
						<Steps current={stage} />
					</div>
				</div>
			)}

			<main className="max-w-screen-xl mx-auto p-3 lg:p-4 w-full flex-1">
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
							onSelectAuctionRecruitment={(id) => {
								setAuctionRecruitmentId(id);
								setAuctionTournamentId(null);
								setStage("AUCTION_DRAFT");
							}}
							onSelectAuctionTournament={(id) => {
								setAuctionTournamentId(id);
								setAuctionRecruitmentId(null);
								setStage("AUCTION_DRAFT");
							}}
							onOpenLeaderboard={() => setStage("LEADERBOARD")}
							onOpenMinigame={() => setStage("MINIGAME")}
							onOpenHelp={() => setHelpOpen(true)}
							onOpenMyProfile={() => openProfile(user.id)}
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
							onManageRiotAccounts={() => setStage("MY_RIOT_ACCOUNTS")}
						/>
					</ErrorBoundary>
				)}
				{stage === "MY_RIOT_ACCOUNTS" && (
					<ErrorBoundary key="my-riot-accounts" label="라이엇 계정 관리" onReset={goHome}>
						<MyRiotAccounts onBack={() => openProfile(user.id)} />
					</ErrorBoundary>
				)}
				{stage === "AUCTION_DRAFT" && (
					<ErrorBoundary
						key={`auction-draft-${auctionTournamentId ?? auctionRecruitmentId}`}
						label="경매내전 드래프트"
						onReset={goHome}
					>
						<AuctionDraft
							tournamentId={auctionTournamentId}
							recruitmentId={auctionRecruitmentId}
							onEnterTournament={(id) => {
								setAuctionTournamentId(id);
								setAuctionRecruitmentId(null);
							}}
							onEnterBracket={(id) => {
								setAuctionTournamentId(id);
								setStage("AUCTION_BRACKET");
							}}
						/>
					</ErrorBoundary>
				)}
				{stage === "AUCTION_BRACKET" && (
					<ErrorBoundary
						key={`auction-bracket-${auctionTournamentId}`}
						label="경매내전 토너먼트"
						onReset={goHome}
					>
						<AuctionBracket
							tournamentId={auctionTournamentId}
							onCompleted={() => setStage("AUCTION_RESULT")}
						/>
					</ErrorBoundary>
				)}
				{stage === "AUCTION_RESULT" && (
					<ErrorBoundary
						key={`auction-result-${auctionTournamentId}`}
						label="경매내전 결과"
						onReset={goHome}
					>
						<AuctionResult tournamentId={auctionTournamentId} onBack={goHome} />
					</ErrorBoundary>
				)}
			</main>

			{/* 페이지 하단 footer — 자주 쓰는 액션 단축키. dropdown 메뉴 안 들어가도 한 번에 진입.
			    LIST/LEADERBOARD/MINIGAME/PROFILE 같은 비-시리즈 흐름에서만 노출 (시리즈 진행 중에는 산만 방지). */}
			{(stage === "LIST" ||
				stage === "LEADERBOARD" ||
				stage === "MINIGAME" ||
				stage === "PROFILE") && (
				<footer className="footer footer-center bg-base-200/60 border-t border-base-300 text-base-content/70 p-4">
					<nav className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full max-w-screen-md">
						<FooterButton
							icon="📇"
							label="내 프로필"
							active={stage === "PROFILE" && profileUserId === user.id}
							onClick={() => openProfile(user.id)}
						/>
						<FooterButton
							icon="🏆"
							label="리더보드"
							active={stage === "LEADERBOARD"}
							onClick={() => setStage("LEADERBOARD")}
						/>
						<FooterButton
							icon="🎲"
							label="도구"
							active={stage === "MINIGAME"}
							onClick={() => setStage("MINIGAME")}
						/>
						<FooterButton icon="❓" label="도움말" onClick={() => setHelpOpen(true)} />
					</nav>
					<aside className="text-[10px] text-base-content/50">
						<p>
							<span className="font-bold">monkey</span> · LoL 내전 매니저
						</p>
					</aside>
				</footer>
			)}

			<Toaster />
			<HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
			<PermsModal open={permsOpen} onClose={() => setPermsOpen(false)} />
		</div>
	);
}

function FooterButton({
	icon,
	label,
	active,
	onClick,
}: {
	icon: string;
	label: string;
	active?: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`btn btn-sm gap-2 ${active ? "btn-primary btn-soft" : "btn-ghost"}`}
		>
			<span className="text-base">{icon}</span>
			<span>{label}</span>
		</button>
	);
}
