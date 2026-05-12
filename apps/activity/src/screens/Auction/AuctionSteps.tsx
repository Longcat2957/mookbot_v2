// 경매내전 5단계 lifecycle 스테퍼 — daisyUI steps-horizontal.
// reader 친화 — 모든 참가자가 어느 단계인지 한눈에. 큰 글자 + sticky top.
//
// 매핑: 8 단계 internal status (CAPTAIN_PICK / POINT_ALLOC / BIDDING /
//   PLACEMENT / BRACKET_SETUP / IN_GAME / COMPLETED / CANCELLED) →
//   5 단계 reader label (팀장 / 포인트 / 경매 / 토너먼트 / 종료).

import type { TournamentStatus } from "./types.js";

type AuctionStepKey = "CAPTAIN" | "POINTS" | "BIDDING" | "BRACKET" | "COMPLETED";

const STEPS: { key: AuctionStepKey; label: string }[] = [
	{ key: "CAPTAIN", label: "팀장 선출" },
	{ key: "POINTS", label: "포인트 배정" },
	{ key: "BIDDING", label: "경매 진행" },
	{ key: "BRACKET", label: "토너먼트" },
	{ key: "COMPLETED", label: "종료" },
];

function mapStatus(status: TournamentStatus | "RECRUITMENT"): AuctionStepKey {
	switch (status) {
		case "CAPTAIN_PICK":
			return "CAPTAIN";
		case "POINT_ALLOC":
			return "POINTS";
		case "BIDDING":
		case "PLACEMENT":
			return "BIDDING";
		case "BRACKET_SETUP":
		case "IN_GAME":
			return "BRACKET";
		case "COMPLETED":
			return "COMPLETED";
		default:
			return "CAPTAIN"; // RECRUITMENT (모집 단계) — 첫 단계로
	}
}

export function AuctionSteps({ status }: { status: TournamentStatus | "RECRUITMENT" }) {
	const currentKey = mapStatus(status);
	const currentIdx = STEPS.findIndex((s) => s.key === currentKey);
	const cancelled = status === "CANCELLED";

	return (
		<ul className="steps steps-horizontal w-full text-sm sm:text-base">
			{STEPS.map((s, i) => {
				const active = !cancelled && i <= currentIdx;
				return (
					<li
						key={s.key}
						className={`step ${active ? "step-primary" : ""}`}
						data-content={cancelled ? "✕" : i < currentIdx ? "✓" : i === currentIdx ? "●" : `${i + 1}`}
					>
						{s.label}
					</li>
				);
			})}
		</ul>
	);
}
