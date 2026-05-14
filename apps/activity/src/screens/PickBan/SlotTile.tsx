import type { Champion } from "./types.js";

export function SlotTile({
	champion,
	active,
	banned = false,
	size = "md",
	onClick,
}: {
	champion: Champion | null;
	active: boolean;
	banned?: boolean;
	size?: "md" | "lg";
	onClick: () => void;
}) {
	const dim = size === "lg" ? "w-12 h-12" : "w-10 h-10";
	return (
		<button
			type="button"
			onClick={onClick}
			title={champion?.name ?? (active ? "다시 클릭하여 해제" : "슬롯 선택")}
			className={`${dim} relative shrink-0 rounded-lg border-2 overflow-hidden transition flex items-center justify-center ${
				active
					? "border-primary ring-4 ring-primary/40 animate-pulse shadow-md shadow-primary/30"
					: champion
						? "border-base-content/30 hover:border-primary/60 hover:ring-2 hover:ring-primary/30"
						: "border-dashed border-base-content/20 hover:border-primary/60 hover:ring-2 hover:ring-primary/20"
			} ${banned && champion ? "grayscale opacity-70" : ""}`}
		>
			{champion ? (
				<img
					src={champion.iconUrl}
					alt={champion.name}
					className="w-full h-full"
					draggable={false}
					loading="lazy"
				/>
			) : (
				<span className="text-2xl text-base-content/30">+</span>
			)}
			{active && champion && (
				<span className="absolute inset-0 flex items-center justify-center bg-error/40 text-white text-[10px] font-bold opacity-0 hover:opacity-100 transition">
					한번 더 = 삭제
				</span>
			)}
		</button>
	);
}
