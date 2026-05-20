import { useState } from "react";
import { cx, IconButton, StatusBadge } from "../../components/DesignPrimitives.js";
import { UserAvatar } from "../../components/UserAvatar.js";
import { useCoarsePointer } from "../../state/useCoarsePointer.js";
import { LANE_LABEL, type Lane, type Participant, ROLE_LABEL } from "./types.js";

const TIER_TEXT_CLASS: Record<string, string> = {
	CHALLENGER: "text-warning",
	GRANDMASTER: "text-error",
	MASTER: "text-secondary",
	DIAMOND: "text-info",
	EMERALD: "text-success",
	PLATINUM: "text-accent",
	GOLD: "text-warning",
	SILVER: "text-base-content/70",
	BRONZE: "text-base-content/60",
	IRON: "text-base-content/50",
};

export function SlotRow({
	lane,
	participant,
	headToHead,
	onDrop,
	onClear,
	onTap,
	selected = false,
	targetHint = false,
	recentlyChanged = false,
}: {
	lane: Lane;
	participant: Participant | null;
	headToHead?: { opponentName: string; plays: number; wins: number; losses: number };
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
			className={cx("flex items-stretch gap-2 rounded-md transition", baseRing)}
		>
			<StatusBadge
				tone="neutral"
				variant="solid"
				className="w-12 min-h-[4.75rem] h-auto justify-center shrink-0 text-sm font-bold"
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
						"flex-1 min-w-0 min-h-[4.75rem] bg-base-300 rounded-md px-2 py-1.5 hover:bg-base-content/10 transition",
						coarse ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
					)}
				>
					<div className="flex items-center gap-1.5 min-w-0">
						<UserAvatar
							discordId={participant.userId}
							displayName={participant.displayName}
							size="xs"
							imageUrl={participant.profileIconUrl ?? null}
						/>
						<span className="font-bold text-sm truncate flex-1 min-w-0">{participant.displayName}</span>
						{participant.history.topRole && (
							<StatusBadge tone="neutral" variant="outline" size="xs" className="shrink-0">
								{ROLE_LABEL[participant.history.topRole.role] ?? participant.history.topRole.role}
							</StatusBadge>
						)}
					</div>
					<SlotMetaLine participant={participant} headToHead={headToHead} />
				</div>
			) : (
				<div className="flex-1 min-h-[4.75rem] text-base-content/40 text-sm italic px-2 py-1.5 border border-dashed border-base-content/20 rounded-md text-center flex items-center justify-center">
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

function SlotMetaLine({
	participant,
	headToHead,
}: {
	participant: Participant;
	headToHead?: { opponentName: string; plays: number; wins: number; losses: number } | undefined;
}) {
	if (headToHead && headToHead.plays > 0) {
		return (
			<div
				className={cx(
					"mt-1 flex min-h-7 flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded border px-2 py-1 text-[0.8125rem] leading-tight",
					headToHead.wins >= headToHead.losses
						? "border-success/30 bg-success/10 text-success-content"
						: "border-error/30 bg-error/10 text-error-content",
				)}
				title={`상대전적 vs ${headToHead.opponentName}: ${headToHead.wins}-${headToHead.losses} (${headToHead.plays}G)`}
			>
				<span className="font-semibold text-base-content/70">상대전적</span>
				<span className="font-bold tabular-nums text-base-content">
					{headToHead.wins}-{headToHead.losses}
				</span>
				<span className="min-w-0 max-w-full truncate text-base-content/60">
					vs {headToHead.opponentName}
				</span>
			</div>
		);
	}

	if (participant.soloRanked) {
		const ranked = participant.soloRanked;
		return (
			<div className="mt-1 flex min-h-7 flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded border border-info/25 bg-info/10 px-2 py-1 text-[0.8125rem] leading-tight">
				<span className="font-semibold text-base-content/70">솔랭</span>
				<span className={cx("font-bold tabular-nums", TIER_TEXT_CLASS[ranked.tier] ?? "text-base-content")}>
					{ranked.tier} {ranked.rank}
				</span>
				<span className="text-base-content/60 tabular-nums">{ranked.leaguePoints}LP</span>
			</div>
		);
	}

	return (
		<div className="mt-1 flex min-h-7 items-center rounded border border-base-content/10 bg-base-100/40 px-2 py-1 text-[0.8125rem] leading-tight text-base-content/35">
			기록 없음
		</div>
	);
}
