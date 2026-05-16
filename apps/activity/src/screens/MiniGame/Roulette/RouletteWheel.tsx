export function RouletteWheel({
	labels,
	segmentSize,
	conicGradient,
	rotation,
	phase,
}: {
	labels: string[];
	segmentSize: number;
	conicGradient: string;
	rotation: number;
	phase: "idle" | "spinning" | "settled";
}) {
	const labelRadius = "calc(clamp(260px, 46vw, 430px) / 2 * 0.65)";

	return (
		<div className="mg-roulette-stage">
			<div className="mg-roulette-pointer" aria-hidden />
			<div className="mg-roulette-orbit mg-roulette-orbit-outer" aria-hidden />
			<div className="mg-roulette-orbit mg-roulette-orbit-inner" aria-hidden />
			<div
				className={`mg-roulette ${phase === "spinning" ? "mg-roulette-spinning" : ""} ${phase === "settled" ? "mg-roulette-settled" : ""}`}
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
