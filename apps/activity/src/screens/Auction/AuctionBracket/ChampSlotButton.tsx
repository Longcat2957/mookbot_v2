import type { Champion } from "./gameInputTypes.js";

export function ChampSlotButton({
	champion,
	onClick,
	onClear,
}: {
	champion: Champion | undefined;
	onClick: () => void;
	onClear?: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`btn btn-xs flex-1 min-w-0 gap-1 ${champion ? "btn-outline" : "btn-ghost"}`}
		>
			{champion ? (
				<>
					<img
						src={champion.iconUrl}
						alt={champion.name}
						width={16}
						height={16}
						className="w-4 h-4 rounded"
						loading="lazy"
						decoding="async"
					/>
					<span className="truncate text-[10px]">{champion.name}</span>
					{onClear && (
						<button
							type="button"
							className="text-base-content/40 hover:text-error"
							onClick={(e) => {
								e.stopPropagation();
								onClear();
							}}
							aria-label={`${champion.name} 제거`}
						>
							✕
						</button>
					)}
				</>
			) : (
				<span className="text-[10px] opacity-60">+ 챔프</span>
			)}
		</button>
	);
}
