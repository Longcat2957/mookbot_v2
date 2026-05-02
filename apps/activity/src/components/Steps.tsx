// 시리즈 라이프사이클 스테퍼 — daisyUI steps.
// 대시보드 / 엔트리 수정 / 픽/밴 / 완료 4 단계.
// MINIGAME 은 라이프사이클 외 보조 도구 — App.tsx 가 stepper 자체를 숨김.

export type StageKey = "LIST" | "ENTRY_EDITING" | "IN_GAME" | "COMPLETED" | "MINIGAME";

const STEPS: { key: StageKey; label: string }[] = [
	{ key: "LIST", label: "대시보드" },
	{ key: "ENTRY_EDITING", label: "엔트리 수정" },
	{ key: "IN_GAME", label: "픽/밴 진행" },
	{ key: "COMPLETED", label: "완료" },
];

export function Steps({ current }: { current: StageKey }) {
	const currentIdx = STEPS.findIndex((s) => s.key === current);

	return (
		<ul className="steps steps-horizontal w-full text-xs sm:text-sm">
			{STEPS.map((s, i) => (
				<li
					key={s.key}
					className={`step ${i <= currentIdx ? "step-primary" : ""}`}
					data-content={i < currentIdx ? "✓" : i === currentIdx ? "●" : `${i + 1}`}
				>
					{s.label}
				</li>
			))}
		</ul>
	);
}
