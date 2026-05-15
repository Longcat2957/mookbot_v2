import type { OrderMode } from "./pickbanOrder.js";

export function ActiveSlotToolbar({
	info,
	autoAdvance,
	orderMode,
	showOrderMode,
	onAutoAdvanceChange,
	onOrderModeChange,
	onCancel,
}: {
	info: string | null;
	autoAdvance: boolean;
	orderMode: OrderMode;
	showOrderMode: boolean;
	onAutoAdvanceChange: (enabled: boolean) => void;
	onOrderModeChange: (mode: OrderMode) => void;
	onCancel: () => void;
}) {
	if (!info) return null;

	return (
		<div className="alert alert-info alert-soft sticky top-2 z-20 shadow-md flex-row items-center flex-wrap gap-2">
			<span className="flex-1 min-w-0">
				{info}
				<span className="text-xs opacity-70 ml-2">— 챔프 선택 또는 슬롯 다시 클릭 (Esc 취소)</span>
			</span>
			<label className="flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap">
				<input
					type="checkbox"
					className="toggle toggle-xs toggle-info"
					checked={autoAdvance}
					onChange={(e) => onAutoAdvanceChange(e.target.checked)}
				/>
				자동 다음
			</label>
			{showOrderMode && (
				<select
					className="select select-xs select-bordered"
					value={orderMode}
					onChange={(e) => onOrderModeChange(e.target.value as OrderMode)}
					title="다음 슬롯 순서 — 자유 / LoL 표준"
				>
					<option value="free">자유</option>
					<option value="lol">LoL 표준</option>
				</select>
			)}
			<button type="button" className="btn btn-xs btn-ghost" onClick={onCancel} aria-label="선택 취소">
				✕
			</button>
		</div>
	);
}
