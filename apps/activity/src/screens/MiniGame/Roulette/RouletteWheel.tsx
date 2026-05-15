export function RouletteWheel({
	labels,
	segmentSize,
	conicGradient,
	rotation,
}: {
	labels: string[];
	segmentSize: number;
	conicGradient: string;
	rotation: number;
}) {
	const labelRadius = "calc(clamp(240px, 60vw, 360px) / 2 * 0.65)";

	return (
		<div className="mg-roulette-stage">
			<div className="mg-roulette-pointer" aria-hidden />
			<div
				className="mg-roulette"
				style={{ background: conicGradient, transform: `rotate(${rotation}deg)` }}
			>
				{labels.map((label, index) => {
					const angle = (index + 0.5) * segmentSize;
					return (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: index is the stable roulette segment identity.
							key={`label-${index}`}
							className="mg-roulette-label"
							style={{
								transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(calc(-1 * ${labelRadius}))`,
							}}
						>
							<span style={{ display: "inline-block", transform: `rotate(${-angle}deg)` }}>{label}</span>
						</div>
					);
				})}
				<div className="mg-roulette-hub" />
			</div>
		</div>
	);
}
