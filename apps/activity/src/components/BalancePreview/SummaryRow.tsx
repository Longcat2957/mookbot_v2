export function SummaryRow({
	t1Avg,
	t2Avg,
	t1Text,
	t2Text,
}: {
	t1Avg: number;
	t2Avg: number;
	t1Text: string;
	t2Text: string;
}) {
	return (
		<div className="grid grid-cols-2 gap-2 pt-2 border-t border-base-300">
			<div className={`text-center text-base ${t1Text}`}>
				평균 <span className="font-bold tabular-nums text-lg">{t1Avg}</span>
			</div>
			<div className={`text-center text-base ${t2Text}`}>
				평균 <span className="font-bold tabular-nums text-lg">{t2Avg}</span>
			</div>
		</div>
	);
}
