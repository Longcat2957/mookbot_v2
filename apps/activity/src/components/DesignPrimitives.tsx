import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export type SurfaceTone = "base" | "soft" | "quiet" | "quietSoft";
export type StatusTone = "neutral" | "primary" | "info" | "success" | "warning" | "error";

export function cx(...values: Array<string | false | null | undefined>): string {
	return values.filter(Boolean).join(" ");
}

const SURFACE_CLASS: Record<SurfaceTone, string> = {
	base: "surface-base",
	soft: "surface-soft",
	quiet: "surface-quiet",
	quietSoft: "surface-quiet-soft",
};

const STATUS_BORDER_CLASS: Record<StatusTone, string> = {
	neutral: "border-base-300",
	primary: "border-primary/50",
	info: "border-info/50",
	success: "border-success/50",
	warning: "border-warning/50",
	error: "border-error/50",
};

const BADGE_TONE_CLASS: Record<StatusTone, string> = {
	neutral: "badge-neutral",
	primary: "badge-primary",
	info: "badge-info",
	success: "badge-success",
	warning: "badge-warning",
	error: "badge-error",
};

const ALERT_TONE_CLASS: Record<Exclude<StatusTone, "neutral" | "primary">, string> = {
	info: "alert-info",
	success: "alert-success",
	warning: "alert-warning",
	error: "alert-error",
};

interface PanelCardProps extends HTMLAttributes<HTMLDivElement> {
	children: ReactNode;
	surface?: SurfaceTone;
	status?: StatusTone;
	bodyClassName?: string;
}

const STATUS_LEFT_BORDER_CLASS: Record<StatusTone, string> = {
	neutral: "border-l-base-300",
	primary: "border-l-primary",
	info: "border-l-info",
	success: "border-l-success",
	warning: "border-l-warning",
	error: "border-l-error",
};

export function PanelCard({
	children,
	surface = "base",
	status = "neutral",
	className,
	bodyClassName,
	...props
}: PanelCardProps) {
	return (
		<div
			className={cx(
				"card border shadow-sm",
				SURFACE_CLASS[surface],
				STATUS_BORDER_CLASS[status],
				className,
			)}
			{...props}
		>
			<div className={cx("card-body", bodyClassName)}>{children}</div>
		</div>
	);
}

interface InteractivePanelCardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	children: ReactNode;
	status?: StatusTone;
	bodyClassName?: string;
}

export function InteractivePanelCard({
	children,
	status = "neutral",
	className,
	bodyClassName,
	type = "button",
	...props
}: InteractivePanelCardProps) {
	return (
		<button
			type={type}
			className={cx(
				"card bg-base-200 shadow-sm cursor-pointer text-left transition-colors border-l-4 hover:bg-base-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
				STATUS_LEFT_BORDER_CLASS[status],
				className,
			)}
			{...props}
		>
			<div className={cx("card-body", bodyClassName)}>{children}</div>
		</button>
	);
}

interface SectionHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
}

export function SectionHeader({
	title,
	description,
	actions,
	className,
	children,
	...props
}: SectionHeaderProps) {
	return (
		<div className={cx("flex flex-wrap items-start justify-between gap-3", className)} {...props}>
			<div className="min-w-0 space-y-1">
				<h2 className="text-base font-bold leading-tight">{title}</h2>
				{description && <p className="text-sm text-base-content/65">{description}</p>}
				{children}
			</div>
			{actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
		</div>
	);
}

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
	tone?: StatusTone;
	size?: "xs" | "sm" | "md" | "lg";
	variant?: "solid" | "soft" | "outline" | "ghost";
	children: ReactNode;
}

export function StatusBadge({
	tone = "neutral",
	size = "sm",
	variant = "soft",
	className,
	children,
	...props
}: StatusBadgeProps) {
	const variantClass =
		variant === "outline"
			? "badge-outline"
			: variant === "ghost"
				? "badge-ghost"
				: variant === "soft"
					? "badge-soft"
					: "";
	return (
		<span
			className={cx("badge", `badge-${size}`, BADGE_TONE_CLASS[tone], variantClass, className)}
			{...props}
		>
			{children}
		</span>
	);
}

interface InlineNoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
	tone?: "info" | "success" | "warning" | "error";
	title?: ReactNode;
	action?: ReactNode;
	children: ReactNode;
}

export function InlineNotice({
	tone = "info",
	title,
	action,
	children,
	className,
	...props
}: InlineNoticeProps) {
	return (
		<div
			role={tone === "error" || tone === "warning" ? "alert" : "status"}
			className={cx("alert alert-soft", ALERT_TONE_CLASS[tone], className)}
			{...props}
		>
			<div className="min-w-0">
				{title && <div className="font-semibold">{title}</div>}
				<div className="text-sm">{children}</div>
			</div>
			{action && <div className="ml-auto shrink-0">{action}</div>}
		</div>
	);
}

export interface ActionMenuItem {
	id: string;
	label: ReactNode;
	description?: ReactNode;
	icon?: ReactNode;
	disabled?: boolean;
	danger?: boolean;
	onSelect: () => void;
}

interface ActionMenuProps {
	label?: ReactNode;
	ariaLabel: string;
	items: ActionMenuItem[];
	align?: "start" | "end";
	buttonClassName?: string;
	menuClassName?: string;
}

export function ActionMenu({
	label = "⋯",
	ariaLabel,
	items,
	align = "end",
	buttonClassName,
	menuClassName,
}: ActionMenuProps) {
	return (
		<details className={cx("dropdown", align === "end" ? "dropdown-end" : "dropdown-start")}>
			<summary
				className={cx("btn btn-sm btn-ghost list-none after:content-none", buttonClassName)}
				aria-label={ariaLabel}
			>
				{label}
			</summary>
			<ul
				className={cx(
					"dropdown-content menu bg-base-100 rounded-box z-30 w-64 p-2 shadow-lg border border-base-300",
					menuClassName,
				)}
			>
				{items.map((item) => (
					<li key={item.id} className={item.disabled ? "menu-disabled" : ""}>
						<button
							type="button"
							disabled={item.disabled}
							className={cx(item.danger && "text-error")}
							onClick={item.onSelect}
						>
							{item.icon && <span className="text-base">{item.icon}</span>}
							<span className="min-w-0">
								<span className="block truncate">{item.label}</span>
								{item.description && (
									<span className="block text-xs text-base-content/60">{item.description}</span>
								)}
							</span>
						</button>
					</li>
				))}
			</ul>
		</details>
	);
}

interface DataListRowProps extends Omit<HTMLAttributes<HTMLLIElement>, "title"> {
	leading?: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	meta?: ReactNode;
	action?: ReactNode;
}

export function DataListRow({
	leading,
	title,
	description,
	meta,
	action,
	className,
	...props
}: DataListRowProps) {
	return (
		<li className={cx("list-row items-center", className)} {...props}>
			{leading}
			<div className="min-w-0">
				<div className="truncate font-medium">{title}</div>
				{description && <div className="text-xs text-base-content/60">{description}</div>}
			</div>
			{meta && <div className="text-sm text-base-content/70">{meta}</div>}
			{action && <div className="shrink-0">{action}</div>}
		</li>
	);
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	label: string;
	tooltip?: string;
	children: ReactNode;
}

export function IconButton({
	label,
	tooltip,
	children,
	className,
	type = "button",
	...props
}: IconButtonProps) {
	const button = (
		<button
			type={type}
			className={cx("btn btn-sm btn-ghost btn-circle", className)}
			aria-label={label}
			{...props}
		>
			{children}
		</button>
	);

	if (!tooltip) return button;
	return (
		<span className="tooltip tooltip-bottom" data-tip={tooltip}>
			{button}
		</span>
	);
}
