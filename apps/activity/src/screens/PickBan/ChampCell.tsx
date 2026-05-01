import type { Champion } from "./types.js";

export function ChampCell({
	champ,
	disabled,
	blocked,
	reason,
	onClick,
	mainCount,
}: {
	champ: Champion;
	disabled?: boolean;
	blocked?: "used" | "fearless";
	reason: string;
	onClick?: () => void;
	mainCount?: number;
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			title={reason}
			className={`relative rounded-md overflow-hidden transition flex flex-col items-center ${
				disabled
					? "opacity-40 grayscale cursor-not-allowed"
					: "hover:ring-2 hover:ring-primary hover:scale-105"
			} ${mainCount ? "ring-1 ring-warning/50" : ""}`}
		>
			<img src={champ.iconUrl} alt={champ.name} className="w-full aspect-square" draggable={false} />
			<span className="text-[10px] truncate w-full px-1 bg-base-300 text-center">{champ.name}</span>
			{blocked === "fearless" && (
				<span
					className="absolute top-0.5 left-0.5 badge badge-error badge-xs"
					aria-label="Hard Fearless"
				>
					F
				</span>
			)}
			{blocked === "used" && (
				<span
					className="absolute top-0.5 left-0.5 badge badge-warning badge-xs"
					aria-label="이번 게임 사용"
				>
					U
				</span>
			)}
			{mainCount !== undefined && mainCount > 0 && (
				<span
					className="absolute top-0.5 right-0.5 badge badge-warning badge-xs tabular-nums"
					aria-label={`${mainCount}회 플레이`}
				>
					{mainCount}
				</span>
			)}
		</button>
	);
}
