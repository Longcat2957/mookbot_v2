import { useEffect } from "react";

export function useHelpShortcut(onToggle: () => void): void {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "?") return;
			const tag = (document.activeElement as HTMLElement | null)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return;
			e.preventDefault();
			onToggle();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onToggle]);
}
