// daisyUI avatar-placeholder — Discord 사용자 아바타 (CDN 없이 일관된 색/이니셜).
// discordId 해시로 의미 색상 매핑 → 같은 사용자는 항상 같은 색.
//
// 추후 Discord avatar CDN 통합 시 image src 옵션 추가 가능 (현재는 placeholder 만).

const COLORS = [
	"bg-primary/30 text-primary-content",
	"bg-secondary/30 text-secondary-content",
	"bg-accent/30 text-accent-content",
	"bg-info/30 text-info-content",
	"bg-warning/30 text-warning-content",
	"bg-success/30 text-success-content",
	"bg-error/30 text-error-content",
] as const;

function hashSeed(s: string): number {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = ((h * 31 + s.charCodeAt(i)) | 0) >>> 0;
	return h;
}

const SIZE_CLASSES = {
	xs: "w-5 h-5 text-[9px]",
	sm: "w-7 h-7 text-[11px]",
	md: "w-9 h-9 text-sm",
	lg: "w-12 h-12 text-base",
	xl: "w-16 h-16 text-xl",
} as const;

export type UserAvatarSize = keyof typeof SIZE_CLASSES;

export function UserAvatar({
	discordId,
	displayName,
	size = "md",
	className = "",
	ring = false,
}: {
	discordId: string;
	displayName: string;
	size?: UserAvatarSize;
	className?: string;
	/** primary 컬러 ring (본인 강조 등에) */
	ring?: boolean;
}) {
	const colorIdx = (hashSeed(discordId || displayName) % COLORS.length) as number;
	const colorClass = COLORS[colorIdx] ?? COLORS[0];
	const initial = (displayName || "?").trim().charAt(0).toUpperCase() || "?";

	return (
		<div className={`avatar avatar-placeholder ${className}`}>
			<div
				className={`${SIZE_CLASSES[size]} rounded-full ${colorClass} font-bold ${
					ring ? "ring-2 ring-primary ring-offset-2 ring-offset-base-200" : ""
				}`}
			>
				<span>{initial}</span>
			</div>
		</div>
	);
}
