import type { Champion, Team } from "./types.js";

export function ResultRadioCard({
	team,
	selected,
	onClick,
	pickIds,
	lanes,
	champById,
	disabled,
}: {
	team: Team;
	selected: boolean;
	onClick: () => void;
	pickIds: (number | null)[];
	lanes: readonly string[];
	champById: Map<number, Champion>;
	disabled: boolean;
}) {
	const teamLabel = team === "TEAM_1" ? "1팀" : "2팀";
	// Tailwind JIT 가 동적 string 을 인식 못 하므로 미리 케이스별 정적 클래스.
	const styles =
		team === "TEAM_1"
			? {
					selectedBg: "bg-info/10 border-info",
					text: "text-info",
					radioFill: "bg-info border-info",
				}
			: {
					selectedBg: "bg-error/10 border-error",
					text: "text-error",
					radioFill: "bg-error border-error",
				};
	return (
		// biome-ignore lint/a11y/useSemanticElements: visual card works as a segmented radio option.
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			role="radio"
			aria-checked={selected}
			className={`relative rounded-box border-2 p-3 text-left transition flex flex-col gap-2 ${
				disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
			} ${selected ? styles.selectedBg : "bg-base-100 border-base-300 hover:border-base-content/30"}`}
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span
						className={`inline-flex items-center justify-center size-5 rounded-full border-2 ${
							selected ? styles.radioFill : "border-base-content/30"
						}`}
						aria-hidden
					>
						{selected && <span className="size-2 rounded-full bg-base-100" />}
					</span>
					<span className={`text-lg font-bold ${styles.text}`}>{teamLabel} 승</span>
					{!disabled && <kbd className="kbd kbd-sm">{team === "TEAM_1" ? "1" : "2"}</kbd>}
				</div>
				{selected && <span className="badge badge-success badge-sm">선택됨</span>}
			</div>
			<div className="flex gap-1 mt-1">
				{pickIds.map((cid, i) => {
					const champ = cid !== null ? champById.get(cid) : null;
					return champ ? (
						<img
							key={`${lanes[i]}-${cid}`}
							src={champ.iconUrl}
							alt={champ.name}
							title={`${lanes[i]} · ${champ.name}`}
							className="size-7 rounded-md ring-1 ring-base-content/10"
							draggable={false}
						/>
					) : (
						<span
							key={`${lanes[i]}-empty`}
							className="size-7 rounded-md border border-dashed border-base-content/20"
							aria-hidden
						/>
					);
				})}
			</div>
		</button>
	);
}
