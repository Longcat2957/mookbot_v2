// Activity 의 키보드 단축키 — 단일 출처.
// 추가/변경 시 반드시 이 파일을 업데이트할 것. HelpModal 이 이 목록을 그대로 렌더링.
// 실제 핸들러는 각 화면 컴포넌트의 useEffect 에 설치돼 있음.
//
// 단축키 컨벤션:
//   - 모달/오버레이/메뉴 오픈 같은 전역: App.tsx 에서 처리
//   - 화면 종속 (픽밴 슬롯 nav, 게임 탭 등): 해당 screen 의 useEffect 에서 처리
//   - INPUT/TEXTAREA 포커스 중에는 단축키 무시 (단, Ctrl 조합은 예외)

export interface ShortcutDoc {
	/** 사용자에게 보일 키 라벨. 여러 키면 "1 / 2 / 3" 처럼 표기. */
	key: string;
	/** 설명. */
	label: string;
	/** 어느 화면에서 동작하는지 — undefined 면 전역. */
	scope?: string;
}

export const SHORTCUTS: ShortcutDoc[] = [
	{ key: "?", label: "도움말 열기 / 닫기" },
	{ key: "/", label: "챔프 검색 input 으로 포커스", scope: "픽/밴" },
	{ key: "Esc", label: "활성 슬롯 해제 · 검색 클리어 · 선택 취소" },
	{ key: "Enter", label: "선택된 후보를 슬롯에 배치", scope: "엔트리 수정" },
	{ key: "Ctrl+1 / 2 / 3", label: "게임 탭 전환", scope: "픽/밴" },
	{ key: "B / R", label: "BLUE / RED 사이드 결정 (미결정 시)", scope: "픽/밴" },
	{ key: "Tab / Shift+Tab", label: "다음 / 이전 슬롯", scope: "픽/밴 (활성 슬롯 시)" },
	{ key: "Backspace", label: "활성 슬롯 챔프 삭제", scope: "픽/밴" },
	{ key: "Ctrl+Z / Ctrl+Shift+Z", label: "Undo / Redo", scope: "엔트리 수정" },
];
