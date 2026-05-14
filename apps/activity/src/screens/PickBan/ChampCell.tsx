import { memo } from "react";
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
	mainCount,
	previousUsage,
}: {
	champ: Champion;
	disabled?: boolean;
	blocked?: "used" | "fearless";
	reason: string;
	onClick?: () => void;
	mainCount?: number;
	previousUsage?: PickUsage[] | undefined;
}) {
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
			onClick={onClick}
			title={reason + usageTitle}
			className={`relative rounded-md overflow-hidden transition flex flex-col items-center ${
				disabled
					? "opacity-40 grayscale cursor-not-allowed"
					: "hover:ring-2 hover:ring-primary hover:scale-105"
			} ${mainCount ? "ring-1 ring-warning/50" : ""}`}
		>
			<img
				src={champ.iconUrl}
				alt={champ.name}
				className="w-full aspect-square"
				draggable={false}
				loading="lazy"
			/>
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
			{previousUsage && previousUsage.length > 0 && (
				<span
					className="absolute bottom-5 right-0.5 badge badge-info badge-xs tabular-nums"
					aria-label={`이전 게임 사용: ${previousUsage.map((u) => `G${u.gameNumber}`).join(", ")}`}
				>
					{previousUsage.map((u) => `G${u.gameNumber}`).join(",")}
				</span>
			)}
		</button>
	);
}

export const ChampCell = memo(ChampCellImpl);
