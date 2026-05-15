export function ResultWarnings({
	allBansFilled,
	allPicksFilled,
}: {
	allBansFilled: boolean;
	allPicksFilled: boolean;
}) {
	if (allBansFilled && allPicksFilled) return null;

	return (
		<div className="alert alert-warning alert-soft py-2">
			<span className="text-xs">
				{!allBansFilled && "밴 슬롯이 비어있습니다. "}
				{!allPicksFilled && "픽 슬롯이 비어있습니다."}
			</span>
		</div>
	);
}
