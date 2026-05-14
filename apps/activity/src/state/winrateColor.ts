// 승률 분류 색상 — 화면 곳곳에 흩어져 있던 if(wr>=60)... 분기의 단일 출처.
// 경계값: 60 이상 = success, 50 이상 = info, 40 이상 = mid(yellow 또는 dim),
//         그 미만 = error.
//
// 변종 3가지:
//   - winrateTextClass(wr)        : 강조 텍스트 (radial-progress 같은 1차 UI)
//   - winrateTextClassDim(wr)     : 보조 텍스트 (sub-line 등) — 중간대를 dim 처리
//   - winrateBadgeClass(wr)       : daisyUI badge 변종

export function winrateTextClass(wr: number): string {
	if (wr >= 60) return "text-success";
	if (wr >= 50) return "text-info";
	if (wr >= 40) return "text-warning";
	return "text-error";
}

export function winrateTextClassDim(wr: number): string {
	if (wr >= 60) return "text-success";
	if (wr >= 50) return "text-info";
	if (wr >= 40) return "text-base-content/70";
	return "text-error";
}

export function winrateBadgeClass(wr: number): string {
	if (wr >= 60) return "badge-success";
	if (wr >= 50) return "badge-info";
	if (wr >= 40) return "badge-warning";
	return "badge-error";
}
