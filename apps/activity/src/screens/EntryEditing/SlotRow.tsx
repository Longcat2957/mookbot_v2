import { useState } from "react";
import { cx, IconButton, StatusBadge } from "../../components/DesignPrimitives.js";
import { UserAvatar } from "../../components/UserAvatar.js";
import { useCoarsePointer } from "../../state/useCoarsePointer.js";
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
	// touch 환경에서는 HTML5 DnD 무효 — draggable 비활성. tap-to-place 만 노출.
	const coarse = useCoarsePointer();

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
		// biome-ignore lint/a11y/noStaticElementInteractions: drop target plus optional tap-to-place behavior.
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
			className={cx("flex items-center gap-2 rounded-md transition", baseRing)}
		>
			<StatusBadge
				tone="neutral"
				variant="solid"
				className="min-w-[3.5rem] justify-center shrink-0 text-sm font-bold"
			>
				{LANE_LABEL[lane]}
			</StatusBadge>
			{participant ? (
				// biome-ignore lint/a11y/noStaticElementInteractions: draggable assigned participant chip.
				<div
					draggable={!coarse}
					onDragStart={
						coarse
							? undefined
							: (e) => {
									e.dataTransfer.setData("text/plain", participant.userId);
									e.dataTransfer.effectAllowed = "move";
								}
					}
					className={cx(
						"flex-1 min-w-0 bg-base-300 rounded-md px-2 py-1.5 hover:bg-base-content/10 transition flex items-center gap-1.5",
						coarse ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
					)}
				>
					<UserAvatar
						discordId={participant.userId}
						displayName={participant.displayName}
						size="xs"
						imageUrl={participant.profileIconUrl ?? null}
					/>
					<span className="font-bold text-sm truncate flex-1">{participant.displayName}</span>
					{participant.history.topRole && (
						<StatusBadge tone="neutral" variant="outline" size="xs" className="shrink-0">
							{ROLE_LABEL[participant.history.topRole.role] ?? participant.history.topRole.role}
						</StatusBadge>
					)}
				</div>
			) : (
				<div className="flex-1 text-base-content/40 text-sm italic px-2 py-1.5 border border-dashed border-base-content/20 rounded-md text-center">
					— 비어있음 —
				</div>
			)}
			<IconButton
				label="슬롯 해제"
				tooltip="슬롯 해제"
				className="btn-xs btn-error shrink-0"
				onClick={onClear}
				disabled={!participant}
			>
				✕
			</IconButton>
		</div>
	);
}
