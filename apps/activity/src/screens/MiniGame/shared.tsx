import type { ReactNode } from "react";
import { cx } from "../../components/DesignPrimitives.js";

export function MiniGameLayout({
	children,
	controls = "right",
	className,
}: {
	children: ReactNode;
	controls?: "left" | "right";
	className?: string;
}) {
	return (
		<div
			className={cx(
				"mg-layout",
				controls === "left" ? "mg-layout-controls-left" : "mg-layout-controls-right",
				className,
			)}
		>
			{children}
		</div>
	);
}

export function MiniGameStage({
	children,
	className,
	header,
	scroll = false,
}: {
	children: ReactNode;
	className?: string;
	header?: ReactNode;
	scroll?: boolean;
}) {
	return (
		<section className={cx("mg-stage", scroll && "mg-stage-scroll", className)}>
			{header && <div className="mg-stage-header">{header}</div>}
			{children}
		</section>
	);
}

export function MiniGameControls({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return <aside className={cx("mg-controls", className)}>{children}</aside>;
}

export function MiniGameSection({
	children,
	className,
	title,
	trailing,
}: {
	children: ReactNode;
	className?: string;
	title?: ReactNode;
	trailing?: ReactNode;
}) {
	return (
		<section className={cx("mg-section", className)}>
			{(title || trailing) && (
				<div className="mg-section-title">
					<span>{title}</span>
					{trailing}
				</div>
			)}
			{children}
		</section>
	);
}

export function MiniGameStatusCard({
	children,
	className,
	live = true,
}: {
	children: ReactNode;
	className?: string;
	live?: boolean;
}) {
	return (
		<section className={cx("mg-status-card", className)} aria-live={live ? "polite" : undefined}>
			{children}
		</section>
	);
}

export function MiniGameActionBar({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return <div className={cx("mg-action-bar", className)}>{children}</div>;
}
