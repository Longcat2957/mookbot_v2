export function DurationInput({
	value,
	onChange,
}: {
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<label className="form-control">
			<div className="label py-1">
				<span className="label-text text-xs text-base-content/70">게임 시간 (분, 선택)</span>
			</div>
			<input
				type="number"
				min="0"
				placeholder="예: 32"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="input input-bordered input-sm"
			/>
		</label>
	);
}
