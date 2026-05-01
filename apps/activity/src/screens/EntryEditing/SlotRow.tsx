import { useState } from "react";
import { LANE_LABEL, type Lane, type Participant, ROLE_LABEL } from "./types.js";

export function SlotRow({
	lane,
	participant,
	onDrop,
	onClear,
	onTap,
	selected = false,
	targetHint = false,
	recentlyChanged = false,
}: {
	lane: Lane;
	participant: Participant | null;
	onDrop: (userId: string) => void;
	onClear: () => void;
	onTap?: () => void;
	selected?: boolean;
	targetHint?: boolean;
	recentlyChanged?: boolean;
}) {
	const [over, setOver] = useState(false);

	const baseRing = over
		? "ring-2 ring-primary bg-primary/10"
		: selected
			? "ring-2 ring-primary bg-primary/10"
			: targetHint && !participant
				? "ring-1 ring-primary/60 bg-primary/5"
				: targetHint
					? "ring-1 ring-warning/60"
					: recentlyChanged
						? "ring-2 ring-info animate-pulse"
						: "";

	return (
		<div
			role={onTap ? "button" : undefined}
			tabIndex={onTap ? 0 : undefined}
			onClick={(e) => {
				// inner ✕ button 클릭 시 슬롯 탭이 트리거되지 않도록 stop
				const target = e.target as HTMLElement;
				if (target.closest("button")) return;
				onTap?.();
			}}
			onKeyDown={(e) => {
				if (onTap && (e.key === "Enter" || e.key === " ")) {
					e.preventDefault();
					onTap();
				}
			}}
			onDragOver={(e) => {
				e.preventDefault();
				e.dataTransfer.dropEffect = "move";
				if (!over) setOver(true);
			}}
			onDragLeave={() => setOver(false)}
			onDrop={(e) => {
				e.preventDefault();
				setOver(false);
				const uid = e.dataTransfer.getData("text/plain");
				if (uid) onDrop(uid);
			}}
			className={`flex items-center gap-2 rounded-md transition ${baseRing}`}
		>
			<span className="badge badge-neutral min-w-[3.5rem] justify-center shrink-0 text-sm font-bold">
				{LANE_LABEL[lane]}
			</span>
			{participant ? (
				<div
					draggable
					onDragStart={(e) => {
						e.dataTransfer.setData("text/plain", participant.userId);
						e.dataTransfer.effectAllowed = "move";
					}}
					className="flex-1 min-w-0 bg-base-300 rounded-md px-2 py-1.5 cursor-grab active:cursor-grabbing hover:bg-base-content/10 transition flex items-center gap-1.5"
				>
					<span className="font-bold text-sm truncate flex-1">{participant.displayName}</span>
					{participant.history.topRole && (
						<span className="badge badge-outline badge-xs shrink-0">
							{ROLE_LABEL[participant.history.topRole.role] ?? participant.history.topRole.role}
						</span>
					)}
				</div>
			) : (
				<div className="flex-1 text-base-content/40 text-sm italic px-2 py-1.5 border border-dashed border-base-content/20 rounded-md text-center">
					— 비어있음 —
				</div>
			)}
			<button
				type="button"
				className="btn btn-error btn-xs shrink-0"
				onClick={onClear}
				disabled={!participant}
				title="슬롯 해제"
			>
				✕
			</button>
		</div>
	);
}
