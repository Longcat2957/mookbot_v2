export function LadderLabelGrid({
	alignColumns = false,
	disabled,
	items,
	labels,
	kind,
	onChange,
}: {
	alignColumns?: boolean;
	disabled: boolean;
	items: number[];
	labels: string[];
	kind: "input" | "output";
	onChange: (labels: string[]) => void;
}) {
	return (
		<div
			className={alignColumns ? "mg-label-grid mg-label-grid-fixed" : "mg-label-grid"}
			style={alignColumns ? { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` } : undefined}
		>
			{items.map((item) => (
				<input
					key={`${kind}-${item}`}
					type="text"
					value={labels[item] ?? ""}
					onChange={(e) =>
						onChange(labels.map((value, index) => (index === item ? e.target.value : value)))
					}
					disabled={disabled}
					maxLength={8}
					className={`input input-xs input-bordered text-center ${kind === "output" ? "font-semibold" : ""}`}
					aria-label={`${kind === "input" ? "입력" : "출력"} ${item + 1} 라벨`}
				/>
			))}
		</div>
	);
}
