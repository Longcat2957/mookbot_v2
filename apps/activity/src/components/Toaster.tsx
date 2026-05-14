// 전역 toast bus — design_upgrade.md §4.1, §4.2.
// 다른 운영자의 WS 변경 / mutation 결과 등 짧은 알림.
//
// 사용:
//   import { showToast } from "./Toaster.js";
//   showToast("저장됨", "success");
//
// App 루트에 <Toaster /> 한 번만 마운트.

import { useEffect, useState } from "react";

export type ToastTone = "info" | "success" | "warning" | "error";

interface ToastEvent {
	id: number;
	message: string;
	tone: ToastTone;
}

const listeners = new Set<(t: ToastEvent) => void>();
let nextId = 1;

// dedupe — 동일 메시지가 짧은 시간 내 반복 fire 되면 무시 (hot_fix.md §3.7).
// WS invalidate 폭발 시 토스트 spam 방지.
const DEDUPE_MS = 1500;
let lastFired: { message: string; tone: ToastTone; at: number } | null = null;

export function showToast(message: string, tone: ToastTone = "info"): void {
	const now = performance.now();
	if (
		lastFired &&
		lastFired.message === message &&
		lastFired.tone === tone &&
		now - lastFired.at < DEDUPE_MS
	) {
		return;
	}
	lastFired = { message, tone, at: now };
	const ev: ToastEvent = { id: nextId++, message, tone };
	for (const cb of listeners) cb(ev);
}

const ALERT_CLASS: Record<ToastTone, string> = {
	info: "alert-info",
	success: "alert-success",
	warning: "alert-warning",
	error: "alert-error",
};

export function Toaster({ timeoutMs = 2500 }: { timeoutMs?: number }) {
	const [toasts, setToasts] = useState<ToastEvent[]>([]);

	useEffect(() => {
		const handler = (t: ToastEvent) => {
			setToasts((prev) => [...prev, t]);
			// dedupe 동일 메시지 연속 — 마지막 것만 살림
			window.setTimeout(() => {
				setToasts((prev) => prev.filter((x) => x.id !== t.id));
			}, timeoutMs);
		};
		listeners.add(handler);
		return () => {
			listeners.delete(handler);
		};
	}, [timeoutMs]);

	return (
		<div
			className="toast toast-bottom toast-end z-50 pointer-events-none"
			role="status"
			aria-live="polite"
			aria-atomic="true"
		>
			{toasts.map((t) => (
				<div
					key={t.id}
					className={`alert ${ALERT_CLASS[t.tone]} alert-soft shadow-md pointer-events-auto`}
				>
					<span>{t.message}</span>
				</div>
			))}
		</div>
	);
}
