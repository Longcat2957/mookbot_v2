import { useState } from "react";
import { UserAvatar } from "../../../components/UserAvatar.js";
import type { AuctionTournamentDetail } from "../types.js";

export function MatchupBuilder({
	teams,
	onPair,
	submitting,
}: {
	teams: AuctionTournamentDetail["teams"];
	onPair: (team1Id: number, team2Id: number) => Promise<void>;
	submitting: boolean;
}) {
	const [t1, setT1] = useState<number | null>(null);
	const [t2, setT2] = useState<number | null>(null);

	const submit = async () => {
		if (!t1 || !t2 || t1 === t2) return;
		await onPair(t1, t2);
		setT1(null);
		setT2(null);
	};

	return (
		<div className="space-y-3">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
				{teams.map((t) => (
					<MatchupTeamButton
						key={t.id}
						team={t}
						isT1={t1 === t.id}
						isT2={t2 === t.id}
						onClick={() => {
							if (t1 === t.id) setT1(null);
							else if (t2 === t.id) setT2(null);
							else if (t1 === null) setT1(t.id);
							else if (t2 === null) setT2(t.id);
						}}
					/>
				))}
			</div>
			<button
				type="button"
				className="btn btn-primary btn-lg w-full"
				onClick={submit}
				disabled={!t1 || !t2 || submitting}
			>
				매치업 생성
			</button>
		</div>
	);
}

function MatchupTeamButton({
	team,
	isT1,
	isT2,
	onClick,
}: {
	team: AuctionTournamentDetail["teams"][number];
	isT1: boolean;
	isT2: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex items-center gap-2.5 p-2.5 rounded-md border-2 transition text-left ${
				isT1
					? "border-info bg-info/10"
					: isT2
						? "border-error bg-error/10"
						: "border-base-300 bg-base-100 hover:bg-base-300/40"
			}`}
		>
			<UserAvatar
				discordId={team.captainUserId}
				displayName={team.captainName}
				imageUrl={team.captainProfileIconUrl}
				size="sm"
			/>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-1.5">
					<div className="badge badge-info badge-sm">팀{team.teamIndex}</div>
					{isT1 && <span className="badge badge-info badge-sm">1번</span>}
					{isT2 && <span className="badge badge-error badge-sm">2번</span>}
				</div>
				<div className="font-bold text-base truncate">{team.captainName}</div>
			</div>
		</button>
	);
}
