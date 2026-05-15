export function ResultProgressSteps({
	team1SideSelected,
	allBansFilled,
	allPicksFilled,
	winnerSelected,
}: {
	team1SideSelected: boolean;
	allBansFilled: boolean;
	allPicksFilled: boolean;
	winnerSelected: boolean;
}) {
	return (
		<ul className="steps steps-horizontal w-full text-xs">
			<li className={`step ${team1SideSelected ? "step-success" : ""}`}>사이드</li>
			<li className={`step ${allBansFilled ? "step-success" : ""}`}>밴</li>
			<li className={`step ${allPicksFilled ? "step-success" : ""}`}>픽</li>
			<li className={`step ${winnerSelected ? "step-success" : ""}`}>승자</li>
		</ul>
	);
}
