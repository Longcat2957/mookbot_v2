// 2-click 카운트다운 confirm 버튼.
// Discord Activity sandbox 가 native confirm/alert 차단 → 시각화된 2-click 패턴.
// 첫 클릭 → 빨강 + N초 progress 카운트다운, 두번째 클릭 = 확정. 타임아웃 = 자동 취소.

import { useCallback, useEffect, useRef, useState } from "react";

interface ConfirmButtonProps {
	label: string;
	confirmLabel?: string;
	onConfirm: () => void | Promise<void>;
	disabled?: boolean;
	className?: string; // 기본 btn class 외 추가 (예: "join-item")
	variant?: "warning" | "error";
	size?: "xs" | "sm" | "md";
	timeoutMs?: number;
	/** tooltip — disabled 여부와 무관하게 hover 시 표시. 이전 title/disabledReason 통합. */
	tooltipText?: string;
}

export function ConfirmButton({
	label,
	confirmLabel = "다시 클릭 = 확정",
	onConfirm,
	disabled,
	className = "",
	variant = "warning",
	size = "sm",
	timeoutMs = 3000,
	tooltipText,
}: ConfirmButtonProps) {
	const [pending, setPending] = useState(false);
	const [running, setRunning] = useState(false);
	// progress.value: 1 → 0 으로 timeoutMs 동안 감소
	const [progress, setProgress] = useState(1);
	const startRef = useRef<number | null>(null);
	const rafRef = useRef<number | null>(null);
	const timerRef = useRef<number | null>(null);

	const cancel = useCallback(() => {
		setPending(false);
		setProgress(1);
		startRef.current = null;
		if (rafRef.current !== null) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
		if (timerRef.current !== null) {
			window.clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	useEffect(() => () => cancel(), [cancel]);

	const tick = () => {
		if (startRef.current === null) return;
		const elapsed = performance.now() - startRef.current;
		const remaining = Math.max(0, 1 - elapsed / timeoutMs);
		setProgress(remaining);
		if (remaining > 0) {
			rafRef.current = requestAnimationFrame(tick);
		}
	};

	const handleClick = async () => {
		if (disabled || running) return;
		if (!pending) {
			setPending(true);
			setProgress(1);
			startRef.current = performance.now();
			rafRef.current = requestAnimationFrame(tick);
			timerRef.current = window.setTimeout(cancel, timeoutMs);
			return;
		}
		// 2번째 클릭 = 확정
		cancel();
		setRunning(true);
		try {
			await onConfirm();
		} finally {
			setRunning(false);
		}
	};

	const sizeClass = size === "xs" ? "btn-xs" : size === "md" ? "" : "btn-sm";
	const baseClass = pending
		? "btn-error"
		: variant === "error"
			? "btn-error btn-outline"
			: "btn-warning";

	const wrapperClass = tooltipText ? "tooltip tooltip-bottom" : "";

	const button = (
		<button
			type="button"
			disabled={disabled || running}
			onClick={handleClick}
			className={`btn ${sizeClass} ${baseClass} ${className} relative overflow-hidden`}
		>
			{running ? (
				<>
					<span className="loading loading-spinner loading-xs" />
					처리 중…
				</>
			) : pending ? (
				confirmLabel
			) : (
				label
			)}
			{pending && (
				<span
					className="absolute bottom-0 left-0 h-0.5 bg-base-content/80"
					style={{ width: `${progress * 100}%`, transition: "none" }}
					aria-hidden
				/>
			)}
		</button>
	);

	if (!wrapperClass) return button;
	return (
		<span className={wrapperClass} data-tip={tooltipText}>
			{button}
		</span>
	);
}
