// W6 — 키보드 단축키 hint 패널. 화면 상단에 한 줄 inline.
// collapse default OPEN, localStorage 영속 (storageKey 제공 시).

import { useEffect, useState } from "react";

export interface Hint {
	keys: string[]; // 예: ["Ctrl", "Enter"] 또는 ["/"]
	label: string;
}

export function KeyboardHints({ hints, storageKey }: { hints: Hint[]; storageKey?: string }) {
	const [dismissed, setDismissed] = useState(() => {
		if (!storageKey) return false;
		try {
			return localStorage.getItem(storageKey) === "1";
		} catch {
			return false;
		}
	});
	useEffect(() => {
		if (!storageKey) return;
		try {
			localStorage.setItem(storageKey, dismissed ? "1" : "0");
		} catch {}
	}, [storageKey, dismissed]);

	if (dismissed) {
		return (
			<button
				type="button"
				className="text-xs text-base-content/40 hover:text-base-content underline self-start"
				onClick={() => setDismissed(false)}
				aria-label="단축키 보기"
			>
				⌨️ 단축키 보기
			</button>
		);
	}
	return (
		<div className="flex items-center gap-x-2 gap-y-1 flex-wrap text-xs text-base-content/70 bg-base-100/40 rounded-md px-2.5 py-1.5 border border-base-300/40">
			<span className="text-base-content/50 select-none">⌨️</span>
			{hints.map((h, i) => (
				<span key={`${h.label}-${i}`} className="flex items-center gap-1 whitespace-nowrap">
					{h.keys.map((k, j) => (
						<span key={`${k}-${j}`} className="flex items-center">
							{j > 0 && <span className="opacity-40 mx-0.5">+</span>}
							<kbd className="kbd kbd-xs">{k}</kbd>
						</span>
					))}
					<span className="ml-0.5">{h.label}</span>
				</span>
			))}
			<button
				type="button"
				className="ml-auto text-base-content/40 hover:text-error"
				onClick={() => setDismissed(true)}
				aria-label="단축키 패널 닫기"
				title="닫기 (다시 보려면 ⌨️ 단축키 보기)"
			>
				✕
			</button>
		</div>
	);
}
