// 미니게임 — 시리즈 라이프사이클과 무관한 보조 도구.
// 1경기 BLUE/RED 진영 뽑기, 팀 분배 등 비공식 결정용.
//
// 의도적으로 서버 상태 / WS / DB 는 건드리지 않는다 — 순수 클라이언트 random.
// 결과를 어디 기록하지 않으므로 운영자가 보고 수동으로 적용.

import { useState } from "react";
import { cx, PanelCard } from "../components/DesignPrimitives.js";
import { CoinFlip } from "./MiniGame/CoinFlip.js";
import { Ladder } from "./MiniGame/Ladder.js";
import { Roulette } from "./MiniGame/Roulette.js";
import "./MiniGame/styles.css";

type Tool = "coin" | "ladder" | "roulette";
type ToolMeta = {
	id: Tool;
	label: string;
	icon: string;
	tone: string;
	description: string;
	accent: "coin" | "ladder" | "roulette";
};

const TOOLS = [
	{
		id: "coin",
		label: "동전",
		icon: "B/R",
		tone: "BLUE · RED",
		description: "BLUE/RED 진영을 즉시 결정합니다.",
		accent: "coin",
	},
	{
		id: "ladder",
		label: "사다리",
		icon: "LINE",
		tone: "MATCH",
		description: "참가자와 결과를 사다리 경로로 매칭합니다.",
		accent: "ladder",
	},
	{
		id: "roulette",
		label: "원판",
		icon: "PICK",
		tone: "RANDOM",
		description: "여러 후보 중 하나를 원판으로 추첨합니다.",
		accent: "roulette",
	},
] satisfies readonly [ToolMeta, ToolMeta, ToolMeta];

export function MiniGame({ onBack }: { onBack: () => void }) {
	const [tool, setTool] = useState<Tool>("coin");
	const activeTool = TOOLS.find((item) => item.id === tool) ?? TOOLS[0];

	return (
		<section className="mg-console min-w-0">
			<div
				className={`mg-console-header surface-base border border-base-300 rounded-lg mg-accent-${activeTool.accent}`}
			>
				<div className="flex items-center justify-between gap-3 flex-wrap">
					<div className="min-w-0">
						<div className="mg-console-eyebrow">MINIGAME</div>
						<h1 className="text-2xl sm:text-3xl font-bold leading-tight truncate">{activeTool.label}</h1>
						<p className="mt-1 text-sm text-base-content/60 truncate">{activeTool.description}</p>
					</div>
					<button type="button" className="btn btn-ghost btn-sm gap-1.5" onClick={onBack}>
						<span aria-hidden>←</span>
						대시보드
					</button>
				</div>
			</div>

			<div role="tablist" className="grid grid-cols-3 gap-2 sm:gap-3">
				{TOOLS.map(({ id, label, icon, tone, description, accent }) => (
					<button
						key={id}
						type="button"
						role="tab"
						className={cx(
							"mg-tool-tab",
							`mg-accent-${accent}`,
							tool === id ? "mg-tool-tab-active" : "mg-tool-tab-idle",
						)}
						onClick={() => setTool(id)}
						aria-selected={tool === id}
					>
						<span className="mg-tool-icon" aria-hidden>
							{icon}
						</span>
						<span className="min-w-0 text-left">
							<span className="block truncate font-bold">{label}</span>
							<span className="block truncate text-[10px] opacity-65">{tone}</span>
							<span className="mg-tool-description">{description}</span>
						</span>
					</button>
				))}
			</div>

			<PanelCard surface="soft" className="mg-tool-frame" bodyClassName="mg-tool-body">
				{tool === "coin" && <CoinFlip />}
				{tool === "ladder" && <Ladder />}
				{tool === "roulette" && <Roulette />}
			</PanelCard>
		</section>
	);
}
