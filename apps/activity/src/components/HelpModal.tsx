// 도움말 modal — design_upgrade.md §4.7
// 화면별 사용법 + 단축키 안내. navbar 의 ? 버튼 또는 ? 키로 열림.
//
// SHORTCUTS 는 `state/shortcuts.ts` 의 단일 출처에서 import — 단축키 추가/변경
// 시 그 파일만 수정하면 이 모달이 자동 따라온다. (drift 방지)

import { useEffect, useRef } from "react";
import { SHORTCUTS } from "../state/shortcuts.js";

interface Props {
	open: boolean;
	onClose: () => void;
}

const NAVBAR_ITEMS: { icon: string; title: string; body: string }[] = [
	{
		icon: "🏆",
		title: "리더보드",
		body:
			"라인별 (탑/정글/미드/원딜/서폿) + 통합 (가중평균 MMR) 6 탭. 본인 row 는 YOU 배지 + 하이라이트. 행 클릭 → 그 사람 프로필.",
	},
	{
		icon: "🎲",
		title: "미니게임 / 보조 도구",
		body:
			"동전 던지기 (BLUE/RED) · 사다리타기 (2~10명) · 원판 돌리기 (2~8 segment). 1경기 진영 뽑기 / 즉석 팀 분배 등 시리즈 외 보조용. 결과는 자동 기록 X.",
	},
	{
		icon: "📇",
		title: "내 프로필 (우상단 닉네임 → dropdown)",
		body:
			"라인별 MMR 카드 · MMR 시계열 그래프 · 주력 챔프 top 5 · 최근 20 게임. 시리즈 라인업의 멤버 이름을 클릭해도 그 사람 프로필로 이동.",
	},
	{
		icon: "?",
		title: "도움말",
		body: "이 모달. ? 키로도 열림.",
	},
];

const SCREEN_TIPS: { title: string; body: string }[] = [
	{
		title: "대시보드",
		body:
			"처리 대기 카드 (모집 ▾ 진행중) 를 클릭하면 다음 단계로 이동합니다. 가장 오래된 항목이 위로 정렬됩니다.",
	},
	{
		title: "엔트리 수정",
		body:
			"후보 풀에서 사람을 슬롯으로 드래그 또는 탭하여 배치. 슬롯 끼리 드래그/탭으로 swap. 자동 배치 제안은 의도적으로 없음 — 라인 밸런싱은 운영자가 직접.",
	},
	{
		title: "픽 / 밴",
		body:
			"슬롯 클릭 → 활성화 → 챔프 그리드에서 챔프 클릭. 활성 슬롯의 픽 라인 플레이어 주력 챔프가 ‘🌟 주력’ 섹션으로 우선 표시됩니다. 위험 액션은 우상단 ⋯ 메뉴. 운영자는 [📋 일괄 입력] 패널로 콤마 입력 가능.",
	},
	{
		title: "시리즈 결과",
		body:
			"게임별 collapse 를 펼쳐 픽 / 밴 / 라인업 확인. 우승팀은 border-success 와 WIN 뱃지로 표시. 라인업 멤버 클릭 → 그 사람 프로필.",
	},
	{
		title: "리더보드 / 프로필",
		body:
			"리더보드 행을 클릭하면 그 사람의 프로필 (라인별 MMR + 그래프 + 최근 게임) 로 이동. 게임 결과 입력 시 실시간 자동 갱신.",
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
						<button type="submit" className="btn btn-sm btn-circle btn-ghost" aria-label="닫기">
							✕
						</button>
					</form>
				</div>

				<section className="space-y-2 mb-4">
					<h4 className="font-bold text-sm text-base-content/70 uppercase tracking-wide">
						우상단 도구바
					</h4>
					<div className="space-y-1.5">
						{NAVBAR_ITEMS.map((n) => (
							<div key={n.title} className="bg-base-200 rounded-md p-2.5 flex gap-2.5">
								<span className="text-xl leading-none mt-0.5">{n.icon}</span>
								<div className="flex-1 min-w-0">
									<div className="font-bold text-sm">{n.title}</div>
									<div className="text-xs text-base-content/70 leading-snug">{n.body}</div>
								</div>
							</div>
						))}
					</div>
				</section>

				<section className="space-y-2 mb-4">
					<h4 className="font-bold text-sm text-base-content/70 uppercase tracking-wide">단축키</h4>
					<table className="table table-sm">
						<tbody>
							{SHORTCUTS.map((s) => (
								<tr key={s.key}>
									<td className="w-40 align-top">
										<kbd className="kbd kbd-sm">{s.key}</kbd>
									</td>
									<td className="text-sm">
										{s.label}
										{s.scope && <span className="text-xs text-base-content/50 ml-1">({s.scope})</span>}
									</td>
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
								<div className="text-xs text-base-content/70 leading-snug">{t.body}</div>
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
