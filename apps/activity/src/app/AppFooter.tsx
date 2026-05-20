import type { AuthedUser } from "../sdk/client.js";
import { FooterButton } from "./FooterButton.js";
import { loadLeaderboard, loadMiniGame, loadProfile } from "./screenLoaders.js";
import type { AppNavigation } from "./useAppNavigation.js";

export function AppFooter({
	user,
	nav,
	onOpenHelp,
}: {
	user: AuthedUser;
	nav: AppNavigation;
	onOpenHelp: () => void;
}) {
	const showFooter =
		nav.stage === "LIST" ||
		nav.stage === "LEADERBOARD" ||
		nav.stage === "MINIGAME" ||
		nav.stage === "PROFILE" ||
		nav.stage === "MY_RIOT_ACCOUNTS" ||
		nav.stage === "COMPLETED" ||
		nav.stage === "AUCTION_RESULT";

	if (!showFooter) {
		return null;
	}

	return (
		<footer className="footer footer-center bg-base-200/70 border-t border-base-300 text-base-content/70 p-3 sm:p-4">
			<nav className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full max-w-screen-md">
				<FooterButton
					icon="📇"
					label="내 프로필"
					active={
						(nav.stage === "PROFILE" && nav.profileUserId === user.id) || nav.stage === "MY_RIOT_ACCOUNTS"
					}
					onClick={() => nav.openProfile(user.id)}
					onPrefetch={loadProfile}
				/>
				<FooterButton
					icon="🏆"
					label="리더보드"
					active={nav.stage === "LEADERBOARD"}
					onClick={nav.openLeaderboard}
					onPrefetch={loadLeaderboard}
				/>
				<FooterButton
					icon="🎲"
					label="도구"
					active={nav.stage === "MINIGAME"}
					onClick={nav.openMinigame}
					onPrefetch={loadMiniGame}
				/>
				<FooterButton icon="❓" label="도움말" onClick={onOpenHelp} />
			</nav>
			<aside className="text-[10px] text-base-content/50">
				<p>
					<span className="font-bold">monkey</span> · LoL 내전 매니저
				</p>
			</aside>
		</footer>
	);
}
