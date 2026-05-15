import type { StageKey } from "../components/Steps.js";

export function ContextChip({
	stage,
	recruitmentId,
	seriesId,
}: {
	stage: StageKey;
	recruitmentId: number | null;
	seriesId: number | null;
}) {
	if (stage === "LIST") return null;

	const items: string[] = (() => {
		switch (stage) {
			case "ENTRY_EDITING":
				return recruitmentId !== null
					? [`📋 모집 #${recruitmentId}`, "엔트리 수정"]
					: ["📋 엔트리 수정"];
			case "IN_GAME":
				return seriesId !== null
					? [`📋 모집 #${seriesId}`, `🎮 시리즈 #${seriesId}`, "픽/밴"]
					: ["🎮 시리즈"];
			case "COMPLETED":
				return seriesId !== null
					? [`📋 모집 #${seriesId}`, `🎮 시리즈 #${seriesId}`, "✅ 종료"]
					: ["✅ 시리즈 종료"];
			case "PROFILE":
				return ["👤 프로필"];
			case "MY_RIOT_ACCOUNTS":
				return ["🔗 라이엇 계정 관리"];
			case "LEADERBOARD":
				return ["🏆 리더보드"];
			case "MINIGAME":
				return ["🎲 도구"];
			case "AUCTION_DRAFT":
				return ["💰 경매 드래프트"];
			case "AUCTION_BRACKET":
				return ["🏟 경매 토너먼트"];
			case "AUCTION_RESULT":
				return ["🏁 경매 결과"];
			default:
				return [];
		}
	})();
	if (items.length === 0) return null;

	return (
		<div className="breadcrumbs text-xs font-medium max-w-full min-w-0 py-0">
			<ul>
				{items.map((item, i) => (
					<li
						key={item}
						className={i === items.length - 1 ? "text-base-content" : "text-base-content/55"}
					>
						<span className="truncate">{item}</span>
					</li>
				))}
			</ul>
		</div>
	);
}
