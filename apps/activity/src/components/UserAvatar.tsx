// daisyUI avatar — Discord 사용자 아바타.
//
// 두 가지 모드:
//   1) imageUrl 있음: 챔프 아이콘(또는 임의 image) 표시 — Data Dragon CDN 권장
//   2) imageUrl 없음: avatar-placeholder + discordId 해시 → 7색 중 하나 + 이니셜
//
// 같은 사용자는 imageUrl 없을 때도 항상 같은 색상이 보장됨 (해시 기반).
// ring={isMe} 옵션으로 본인 강조 (primary 컬러 ring).

const COLORS = [
	"bg-primary/30",
	"bg-secondary/30",
	"bg-accent/30",
	"bg-info/30",
	"bg-warning/30",
	"bg-success/30",
	"bg-error/30",
] as const;

function hashSeed(s: string): number {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = ((h * 31 + s.charCodeAt(i)) | 0) >>> 0;
	return h;
}

const SIZE_W: Record<string, string> = {
	xs: "w-5 h-5",
	sm: "w-7 h-7",
	md: "w-9 h-9",
	lg: "w-12 h-12",
	xl: "w-16 h-16",
};

const SIZE_TEXT: Record<string, string> = {
	xs: "text-[9px]",
	sm: "text-[11px]",
	md: "text-sm",
	lg: "text-base",
	xl: "text-xl",
};

export type UserAvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

export function UserAvatar({
	discordId,
	displayName,
	imageUrl,
	size = "md",
	className = "",
	ring = false,
}: {
	discordId: string;
	displayName: string;
	/** 챔프 아이콘 등 실제 이미지 — 있으면 placeholder 대신 사용. Data Dragon URL 권장. */
	imageUrl?: string | null;
	size?: UserAvatarSize;
	className?: string;
	/** primary 컬러 ring (본인 강조 등에) */
	ring?: boolean;
}) {
	const sizeW = SIZE_W[size] ?? SIZE_W.md;
	const sizeText = SIZE_TEXT[size] ?? SIZE_TEXT.md;
	const ringClass = ring ? "ring-2 ring-primary ring-offset-2 ring-offset-base-200" : "";

	if (imageUrl) {
		return (
			<div className={`avatar shrink-0 ${className}`}>
				<div className={`${sizeW} rounded-full ${ringClass} bg-base-300`}>
					<img src={imageUrl} alt={displayName} loading="lazy" />
				</div>
			</div>
		);
	}

	// placeholder fallback
	const colorIdx = hashSeed(discordId || displayName) % COLORS.length;
	const colorClass = COLORS[colorIdx] ?? COLORS[0];
	const initial = (displayName || "?").trim().charAt(0).toUpperCase() || "?";

	return (
		<div className={`avatar avatar-placeholder shrink-0 ${className}`}>
			<div className={`${sizeW} ${sizeText} rounded-full ${colorClass} font-bold ${ringClass}`}>
				<span>{initial}</span>
			</div>
		</div>
	);
}
