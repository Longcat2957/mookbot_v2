import { memo, useCallback } from "react";
import { cx, StatusBadge } from "../../components/DesignPrimitives.js";
import { markRender } from "../../debug/renderMetrics.js";
import type { Champion, PickUsage } from "./types.js";

const TEAM_LABEL = { TEAM_1: "1팀", TEAM_2: "2팀" } as const;
const LANE_SHORT: Record<string, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};

// 그리드에 한 번에 ~160 개 렌더되므로 React.memo 로 props 미변동 시 skip.
// 부모(PickBanBoard, ChampPickerModal) 가 onClick 을 useCallback 으로 만들면 효과 큼.
function ChampCellImpl({
	champ,
	disabled,
	blocked,
	reason,
	onClick,
	onSelect,
	mainCount,
	previousUsage,
}: {
	champ: Champion;
	disabled?: boolean;
	blocked?: "used" | "fearless";
	reason: string;
	onClick?: () => void;
	onSelect?: (championId: number) => void;
	mainCount?: number;
	previousUsage?: PickUsage[] | undefined;
}) {
	markRender("PickBan.ChampCell");
	const handleClick = useCallback(() => {
		if (onClick) {
			onClick();
			return;
		}
		onSelect?.(champ.id);
	}, [champ.id, onClick, onSelect]);

	// W3 — 이전 게임 사용 정보. title 에 append + 좌하단 G1/G2 badge.
	const usageTitle = previousUsage?.length
		? `\n${previousUsage
				.map(
					(u) =>
						`G${u.gameNumber} ${TEAM_LABEL[u.team]} ${LANE_SHORT[u.role] ?? u.role} 픽 (${u.win ? "W" : "L"})`,
				)
				.join("\n")}`
		: "";
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={handleClick}
			title={reason + usageTitle}
			className={cx(
				"relative rounded-md overflow-hidden transition flex flex-col items-center",
				disabled
					? "opacity-40 grayscale cursor-not-allowed"
					: "hover:ring-2 hover:ring-primary hover:scale-105",
				mainCount ? "ring-1 ring-warning/50" : "",
			)}
		>
			<img
				src={champ.iconUrl}
				alt={champ.name}
				width={64}
				height={64}
				className="w-full aspect-square"
				draggable={false}
				loading="lazy"
				decoding="async"
			/>
			<span className="text-[10px] truncate w-full px-1 bg-base-300 text-center">{champ.name}</span>
			{blocked === "fearless" && (
				<StatusBadge
					tone="error"
					size="xs"
					className="absolute top-0.5 left-0.5"
					role="img"
					aria-label="Hard Fearless"
				>
					F
				</StatusBadge>
			)}
			{blocked === "used" && (
				<StatusBadge
					tone="warning"
					size="xs"
					className="absolute top-0.5 left-0.5"
					role="img"
					aria-label="이번 게임 사용"
				>
					U
				</StatusBadge>
			)}
			{mainCount !== undefined && mainCount > 0 && (
				<StatusBadge
					tone="warning"
					size="xs"
					className="absolute top-0.5 right-0.5 tabular-nums"
					role="img"
					aria-label={`${mainCount}회 플레이`}
				>
					{mainCount}
				</StatusBadge>
			)}
			{previousUsage && previousUsage.length > 0 && (
				<StatusBadge
					tone="info"
					size="xs"
					className="absolute bottom-5 right-0.5 tabular-nums"
					role="img"
					aria-label={`이전 게임 사용: ${previousUsage.map((u) => `G${u.gameNumber}`).join(", ")}`}
				>
					{previousUsage.map((u) => `G${u.gameNumber}`).join(",")}
				</StatusBadge>
			)}
		</button>
	);
}

export const ChampCell = memo(ChampCellImpl);
