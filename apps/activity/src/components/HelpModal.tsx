// 도움말 modal — design_upgrade.md §4.7
// 화면별 사용법 + 단축키 안내. navbar 의 ? 버튼 또는 ? 키로 열림.

import { useEffect, useRef } from "react";

interface Props {
	open: boolean;
	onClose: () => void;
}

const SHORTCUTS: { key: string; label: string }[] = [
	{ key: "?", label: "이 도움말 열기 / 닫기" },
	{ key: "/", label: "챔프 검색 input 으로 포커스 (픽/밴)" },
	{ key: "Esc", label: "활성 슬롯 해제 · 검색 클리어 · 선택 취소" },
	{ key: "Enter", label: "선택된 후보를 슬롯에 배치 (엔트리 수정)" },
	{ key: "1 / 2 / 3", label: "게임 탭 전환 (픽/밴)" },
];

const SCREEN_TIPS: { title: string; body: string }[] = [
	{
		title: "대시보드",
		body: "처리 대기 카드 (모집 ▾ 진행중) 를 클릭하면 다음 단계로 이동합니다. 가장 오래된 항목이 위로 정렬됩니다.",
	},
	{
		title: "엔트리 수정",
		body: "후보 풀에서 사람을 슬롯으로 드래그 또는 탭하여 배치. 슬롯 끼리 드래그/탭으로 swap. 자동 배치 제안은 의도적으로 없음 — 라인 밸런싱은 운영자가 직접.",
	},
	{
		title: "픽 / 밴",
		body: "슬롯 클릭 → 활성화 → 챔프 그리드에서 챔프 클릭. 활성 슬롯의 픽 라인 플레이어 주력 챔프가 ‘🌟 주력’ 섹션으로 우선 표시됩니다. 위험 액션은 우상단 ⋯ 메뉴.",
	},
	{
		title: "시리즈 결과",
		body: "게임별 collapse 를 펼쳐 픽 / 밴 / 라인업 확인. 우승팀은 border-success 와 WIN 뱃지로 표시.",
	},
];

export function HelpModal({ open, onClose }: Props) {
	const dialogRef = useRef<HTMLDialogElement | null>(null);

	useEffect(() => {
		const dlg = dialogRef.current;
		if (!dlg) return;
		if (open && !dlg.open) dlg.showModal();
		else if (!open && dlg.open) dlg.close();
	}, [open]);

	useEffect(() => {
		const dlg = dialogRef.current;
		if (!dlg) return;
		const handleClose = () => onClose();
		dlg.addEventListener("close", handleClose);
		return () => dlg.removeEventListener("close", handleClose);
	}, [onClose]);

	return (
		<dialog ref={dialogRef} className="modal modal-bottom sm:modal-middle">
			<div className="modal-box max-w-2xl">
				<div className="flex items-center justify-between mb-3">
					<h3 className="font-bold text-lg">도움말</h3>
					<form method="dialog">
						<button
							type="submit"
							className="btn btn-sm btn-circle btn-ghost"
							aria-label="닫기"
						>
							✕
						</button>
					</form>
				</div>

				<section className="space-y-2 mb-4">
					<h4 className="font-bold text-sm text-base-content/70 uppercase tracking-wide">
						단축키
					</h4>
					<table className="table table-sm">
						<tbody>
							{SHORTCUTS.map((s) => (
								<tr key={s.key}>
									<td className="w-32 align-top">
										<kbd className="kbd kbd-sm">{s.key}</kbd>
									</td>
									<td className="text-sm">{s.label}</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>

				<section className="space-y-2">
					<h4 className="font-bold text-sm text-base-content/70 uppercase tracking-wide">
						화면별 사용법
					</h4>
					<div className="space-y-2">
						{SCREEN_TIPS.map((t) => (
							<div key={t.title} className="bg-base-200 rounded-md p-3">
								<div className="font-bold text-sm mb-0.5">{t.title}</div>
								<div className="text-xs text-base-content/70 leading-snug">
									{t.body}
								</div>
							</div>
						))}
					</div>
				</section>

				<div className="modal-action mt-4">
					<form method="dialog">
						<button type="submit" className="btn btn-sm">
							닫기
						</button>
					</form>
				</div>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button type="submit" aria-label="배경 클릭으로 닫기">
					close
				</button>
			</form>
		</dialog>
	);
}
