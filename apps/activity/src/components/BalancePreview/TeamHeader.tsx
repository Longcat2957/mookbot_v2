import type { Side } from "./types.js";

export function TeamHeader({
	team1Side,
	team2Side,
	t1Badge,
	t2Badge,
}: {
	team1Side: Side;
	team2Side: Side;
	t1Badge: string;
	t2Badge: string;
}) {
	return (
		<div className="grid grid-cols-2 gap-2">
			<div className={`badge ${t1Badge} w-full justify-center font-bold py-3`}>1팀 · {team1Side}</div>
			<div className={`badge ${t2Badge} w-full justify-center font-bold py-3`}>2팀 · {team2Side}</div>
		</div>
	);
}
