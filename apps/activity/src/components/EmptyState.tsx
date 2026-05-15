// 빈 상태가 단순 메시지가 아니라 "다음 액션을 가르치는" onboarding 카드.
// design_upgrade.md §4.7

import type { ReactNode } from "react";

interface EmptyStateAction {
	label: string;
	onClick: () => void;
	variant?: "primary" | "ghost";
}

interface EmptyStateProps {
	icon?: ReactNode;
	title: string;
	description?: ReactNode;
	steps?: Array<{ id: string; content: ReactNode }>; // 번호 매긴 다음 액션 가이드
	/** CTA 버튼들 — label/onClick 객체 배열. 호출처가 매번 button 작성 안 하도록. */
	actions?: EmptyStateAction[];
	tone?: "neutral" | "info" | "warning";
}

const TONE_BORDER: Record<NonNullable<EmptyStateProps["tone"]>, string> = {
	neutral: "border-base-300",
	info: "border-info/40",
	warning: "border-warning/40",
};

export function EmptyState({
	icon,
	title,
	description,
	steps,
	actions,
	tone = "neutral",
}: EmptyStateProps) {
	return (
		<div className={`card surface-base border ${TONE_BORDER[tone]} shadow-sm`} role="status">
			<div className="card-body items-center text-center py-8 gap-3">
				{icon && (
					<div className="text-base-content/40" aria-hidden>
						{icon}
					</div>
				)}
				<h3 className="card-title text-base">{title}</h3>
				{description && <p className="text-sm text-base-content/70 max-w-prose">{description}</p>}
				{steps && steps.length > 0 && (
					<ol className="text-sm text-base-content/80 mt-2 space-y-1.5 text-left max-w-prose">
						{steps.map((s, i) => (
							<li key={s.id} className="flex gap-2">
								<span className="badge badge-ghost badge-sm shrink-0 mt-0.5 tabular-nums">{i + 1}</span>
								<span>{s.content}</span>
							</li>
						))}
					</ol>
				)}
				{actions && actions.length > 0 && (
					<div className="mt-2 flex flex-wrap gap-2 justify-center">
						{actions.map((a) => (
							<button
								type="button"
								key={a.label}
								onClick={a.onClick}
								className={`btn btn-sm ${a.variant === "ghost" ? "btn-ghost" : "btn-primary"}`}
							>
								{a.label}
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
