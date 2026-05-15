import { useCallback, useState } from "react";
import { HelpModal } from "../components/HelpModal.js";
import { PermsModal } from "../components/PermsModal.js";
import { Toaster } from "../components/Toaster.js";
import type { AuthedUser } from "../sdk/client.js";
import { AppFooter } from "./AppFooter.js";
import { AppHeader } from "./AppHeader.js";
import { AppMain } from "./AppMain.js";
import { useAppNavigation } from "./useAppNavigation.js";
import { useHelpShortcut } from "./useHelpShortcut.js";

export function AppShell({ user }: { user: AuthedUser }) {
	const nav = useAppNavigation();
	const [helpOpen, setHelpOpen] = useState(false);
	const [permsOpen, setPermsOpen] = useState(false);
	const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
	const openHelp = useCallback(() => setHelpOpen(true), []);
	const toggleHelp = useCallback(() => setHelpOpen((v) => !v), []);

	useHelpShortcut(toggleHelp);

	return (
		<div className="min-h-screen bg-base-100 flex flex-col">
			<AppHeader
				user={user}
				nav={nav}
				mobileSearchOpen={mobileSearchOpen}
				onToggleMobileSearch={() => setMobileSearchOpen((v) => !v)}
				onSelectMobileUser={(uid) => {
					setMobileSearchOpen(false);
					nav.openProfile(uid);
				}}
				onOpenHelp={openHelp}
				onOpenPerms={() => setPermsOpen(true)}
			/>
			<AppMain user={user} nav={nav} onOpenHelp={openHelp} />
			<AppFooter user={user} nav={nav} onOpenHelp={openHelp} />

			<Toaster />
			<HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
			<PermsModal open={permsOpen} onClose={() => setPermsOpen(false)} />
		</div>
	);
}
