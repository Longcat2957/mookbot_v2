// 챔프 선택 모달 — 검색 + 그리드. AuctionBracket 의 픽/밴 입력에 사용.
// PickBan 의 ChampCell 재사용.

import { useEffect, useRef, useState } from "react";
import { ChampCell } from "../PickBan/ChampCell.js";
import type { Champion } from "../PickBan/types.js";

export function ChampPickerModal({
	open,
	champions,
	disabled,
	onSelect,
	onClose,
}: {
	open: boolean;
	champions: Champion[];
	/** 비활성 (이미 선택된) 챔프 id set. 클릭 안 됨. */
	disabled?: Set<number>;
	onSelect: (champion: Champion) => void;
	onClose: () => void;
}) {
	const [q, setQ] = useState("");
	const inputRef = useRef<HTMLInputElement | null>(null);
	// 모달 열기 직전 포커스 보유한 요소 — 닫을 때 복귀.
	// 네이티브 <dialog> 미사용 (custom div 오버레이) 이므로 수동 복귀 필요.
	const returnFocusRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		if (open) {
			returnFocusRef.current = (document.activeElement as HTMLElement | null) ?? null;
			inputRef.current?.focus();
		} else {
			setQ("");
			returnFocusRef.current?.focus?.();
			returnFocusRef.current = null;
		}
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	if (!open) return null;

	const norm = q.toLowerCase().trim();
	const filtered = norm
		? champions.filter(
				(c) => c.name.toLowerCase().includes(norm) || c.idSlug.toLowerCase().includes(norm),
			)
		: champions;

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop closes on pointer click; Escape is handled globally.
		<div
			className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3"
			role="presentation"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="card bg-base-100 max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
				<div className="card-body p-3 gap-2 flex-1 overflow-hidden flex flex-col">
					<div className="flex items-center gap-2">
						<input
							ref={inputRef}
							type="text"
							value={q}
							onChange={(e) => setQ(e.target.value)}
							placeholder="챔프 검색 (한글/영문)"
							className="input input-bordered input-sm flex-1"
						/>
						<button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
							✕
						</button>
					</div>
					<div className="flex-1 overflow-y-auto">
						<div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
							{filtered.map((c) => {
								const isDisabled = disabled?.has(c.id) ?? false;
								return (
									<ChampCell
										key={c.id}
										champ={c}
										disabled={isDisabled}
										reason={isDisabled ? "이미 선택됨" : c.name}
										onClick={() => {
											if (!isDisabled) {
												onSelect(c);
												onClose();
											}
										}}
									/>
								);
							})}
						</div>
						{filtered.length === 0 && (
							<div className="text-center text-base-content/50 py-8">검색 결과 없음</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
