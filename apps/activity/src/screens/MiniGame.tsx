// 미니게임 — 시리즈 라이프사이클과 무관한 보조 도구.
// 1경기 BLUE/RED 진영 뽑기, 팀 분배 등 비공식 결정용.
//
// 의도적으로 서버 상태 / WS / DB 는 건드리지 않는다 — 순수 클라이언트 random.
// 결과를 어디 기록하지 않으므로 운영자가 보고 수동으로 적용.

import { useState } from "react";
import { CoinFlip } from "./MiniGame/CoinFlip.js";
import { Ladder } from "./MiniGame/Ladder.js";
import { Roulette } from "./MiniGame/Roulette.js";
import "./MiniGame/styles.css";

type Tool = "coin" | "ladder" | "roulette";

export function MiniGame({ onBack }: { onBack: () => void }) {
	const [tool, setTool] = useState<Tool>("coin");

	return (
		<section className="space-y-4">
			<div className="flex items-start justify-between gap-3 flex-wrap">
				<div>
					<h1 className="text-2xl font-bold">🎲 도구</h1>
					<p className="text-sm text-base-content/70">
						랜덤 뽑기 — 1경기 BLUE/RED 진영 결정, 즉석 팀 분배 등 시리즈 외 보조용.
					</p>
				</div>
				<button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
					← 대시보드
				</button>
			</div>

			<div role="tablist" className="tabs tabs-bordered">
				<button
					type="button"
					role="tab"
					className={`tab ${tool === "coin" ? "tab-active" : ""}`}
					onClick={() => setTool("coin")}
					aria-selected={tool === "coin"}
				>
					🪙 동전 던지기
				</button>
				<button
					type="button"
					role="tab"
					className={`tab ${tool === "ladder" ? "tab-active" : ""}`}
					onClick={() => setTool("ladder")}
					aria-selected={tool === "ladder"}
				>
					🪜 사다리타기
				</button>
				<button
					type="button"
					role="tab"
					className={`tab ${tool === "roulette" ? "tab-active" : ""}`}
					onClick={() => setTool("roulette")}
					aria-selected={tool === "roulette"}
				>
					🎡 원판 돌리기
				</button>
			</div>

			<div className="card surface-soft">
				<div className="card-body p-4 sm:p-6">
					{tool === "coin" && <CoinFlip />}
					{tool === "ladder" && <Ladder />}
					{tool === "roulette" && <Roulette />}
				</div>
			</div>

			<p className="text-xs text-base-content/50 text-center">
				결과는 자동 기록되지 않습니다 — 보조 도구일 뿐, 시리즈 데이터에 반영하려면 운영자가 별도 처리.
			</p>
		</section>
	);
}
