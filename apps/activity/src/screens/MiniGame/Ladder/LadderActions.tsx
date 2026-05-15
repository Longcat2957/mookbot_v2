export function LadderActions({
	allDone,
	onReset,
	onStartAll,
}: {
	allDone: boolean;
	onReset: () => void;
	onStartAll: () => void;
}) {
	return (
		<div className="flex justify-center gap-2 flex-wrap">
			<button
				type="button"
				className="btn btn-primary btn-lg gap-2"
				onClick={onStartAll}
				disabled={allDone}
			>
				🪜 전체 결과 보기
			</button>
			<button type="button" className="btn btn-ghost btn-lg" onClick={onReset}>
				재시작
			</button>
		</div>
	);
}
