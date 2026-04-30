// 자동저장 상태 표시 — design_upgrade.md §4.2.
// idle  = 표시 없음
// saving = "저장 중…" 작은 dot 펄스
// saved  = "저장됨 · {경과}" 5초 후 흐려짐
// error  = "저장 실패 · 재시도" 클릭으로 onRetry

import { useEffect, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface Props {
	status: SaveStatus;
	savedAt?: number | null; // performance.now() ms
	onRetry?: () => void;
}

export function SaveStatusIndicator({ status, savedAt = null, onRetry }: Props) {
	const [agoText, setAgoText] = useState("방금");
	const [faded, setFaded] = useState(false);

	useEffect(() => {
		if (status !== "saved" || savedAt === null) {
			setFaded(false);
			return;
		}
		setFaded(false);
		const update = () => {
			const elapsed = (performance.now() - savedAt) / 1000;
			if (elapsed < 3) setAgoText("방금");
			else if (elapsed < 60) setAgoText(`${Math.floor(elapsed)}s 전`);
			else setAgoText(`${Math.floor(elapsed / 60)}분 전`);
		};
		update();
		const tick = window.setInterval(update, 1000);
		const fade = window.setTimeout(() => setFaded(true), 5000);
		return () => {
			window.clearInterval(tick);
			window.clearTimeout(fade);
		};
	}, [status, savedAt]);

	if (status === "idle") return null;

	if (status === "saving") {
		return (
			<span className="text-xs text-base-content/60 inline-flex items-center gap-1">
				<span className="size-1.5 rounded-full bg-base-content/60 animate-pulse" aria-hidden />
				저장 중…
			</span>
		);
	}

	if (status === "error") {
		return (
			<button
				type="button"
				className="text-xs text-warning underline-offset-2 hover:underline cursor-pointer"
				onClick={onRetry}
			>
				저장 실패 · 재시도
			</button>
		);
	}

	// saved
	return (
		<span
			className={`text-xs text-success inline-flex items-center gap-1 transition-opacity duration-1000 ${
				faded ? "opacity-30" : "opacity-100"
			}`}
		>
			<span className="size-1.5 rounded-full bg-success" aria-hidden />
			저장됨 · {agoText}
		</span>
	);
}
