import { SearchBar } from "../components/SearchBar.js";
import { SystemDot } from "../components/SystemDot.js";
import type { AuthedUser } from "../sdk/client.js";
import { usePerms } from "../state/perms.js";
import { ContextChip } from "./ContextChip.js";
import { loadLeaderboard, loadMiniGame, loadProfile } from "./screenLoaders.js";
import type { AppNavigation } from "./useAppNavigation.js";

export function AppHeader({
	user,
	nav,
	mobileSearchOpen,
	onToggleMobileSearch,
	onSelectMobileUser,
	onOpenHelp,
	onOpenPerms,
}: {
	user: AuthedUser;
	nav: AppNavigation;
	mobileSearchOpen: boolean;
	onToggleMobileSearch: () => void;
	onSelectMobileUser: (uid: string) => void;
	onOpenHelp: () => void;
	onOpenPerms: () => void;
}) {
	const perms = usePerms();

	return (
		<>
			<div className="navbar bg-base-200 shadow-sm border-b border-base-300">
				<div className="navbar-start gap-3 px-4 min-w-0">
					<button
						type="button"
						className="text-xl font-bold tracking-tight hover:text-primary cursor-pointer shrink-0 flex items-baseline gap-1.5"
						onClick={nav.goHome}
					>
						<span>monkey</span>
						<span
							className="text-[10px] font-normal text-base-content/40 tabular-nums"
							title={`Activity 버전 ${__APP_VERSION__}`}
						>
							v{__APP_VERSION__}
						</span>
					</button>
					<ContextChip stage={nav.stage} recruitmentId={nav.recruitmentId} seriesId={nav.seriesId} />
				</div>
				<div className="navbar-center hidden md:flex">
					<SearchBar onSelectUser={nav.openProfile} />
				</div>
				<div className="navbar-end gap-1 sm:gap-2 px-2 sm:px-4">
					<button
						type="button"
						className="md:hidden btn btn-ghost btn-sm btn-circle"
						onClick={onToggleMobileSearch}
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
									className={nav.stage === "PROFILE" && nav.profileUserId === user.id ? "active" : ""}
									onClick={() => nav.openProfile(user.id)}
									onFocus={loadProfile}
									onPointerEnter={loadProfile}
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
									className={nav.stage === "LEADERBOARD" ? "active" : ""}
									onClick={nav.openLeaderboard}
									onFocus={loadLeaderboard}
									onPointerEnter={loadLeaderboard}
								>
									<span className="text-base">🏆</span>
									<span>리더보드</span>
								</button>
							</li>
							<li>
								<button
									type="button"
									className={nav.stage === "MINIGAME" ? "active" : ""}
									onClick={nav.openMinigame}
									onFocus={loadMiniGame}
									onPointerEnter={loadMiniGame}
								>
									<span className="text-base">🎲</span>
									<span>도구 / 미니게임</span>
								</button>
							</li>
							<li>
								<button type="button" onClick={onOpenHelp}>
									<span className="text-base">❓</span>
									<span>도움말</span>
									<kbd className="kbd kbd-xs ml-auto">?</kbd>
								</button>
							</li>
							<li>
								<button type="button" onClick={onOpenPerms}>
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

			{mobileSearchOpen && (
				<div className="md:hidden bg-base-200 border-b border-base-300 px-3 py-2">
					<SearchBar onSelectUser={onSelectMobileUser} />
				</div>
			)}
		</>
	);
}
