import type { LineupParticipant } from "../../components/LineupPreview.js";
import {
	type Champion,
	type GameDetail,
	LANE_LABEL,
	LANE_ORDER,
	type Team,
	teamLabel,
} from "./types.js";

export function GameTeamPanel({
	champById,
	game,
	lineup,
	onSelectUser,
	team,
	teamSize,
	blueTeam,
}: {
	champById: Map<number, Champion>;
	game: GameDetail;
	lineup: Map<string, LineupParticipant>;
	onSelectUser?: (userId: string) => void;
	team: Team;
	teamSize: number;
	blueTeam: Team;
}) {
	const isWinner = game.winningTeam === team;
	const side = team === blueTeam ? "BLUE" : "RED";
	const sideTone = side === "BLUE" ? "info" : "error";
	const bans = game.bans.filter((ban) => ban.team === team).sort((a, b) => a.position - b.position);
	const lanes = LANE_ORDER.slice(0, teamSize);
	const banSlots = Array.from({ length: teamSize }, (_, slot) => ({ id: `${team}-${slot}`, slot }));

	return (
		<div
			className={`relative rounded-lg p-3 ${isWinner ? "border border-success bg-success/5" : "surface-quiet-soft"}`}
		>
			{isWinner && <span className="absolute top-2 right-2 badge badge-success badge-sm">WIN</span>}
			<div className="flex items-center gap-2 mb-2">
				<span className={`badge badge-sm ${sideTone === "info" ? "badge-info" : "badge-error"}`}>
					{side}
				</span>
				<span className="font-bold">{teamLabel(team)}</span>
			</div>

			<div className="mb-3">
				<div className="text-[10px] uppercase tracking-wide text-base-content/50 mb-1">밴</div>
				<div className="flex gap-1">
					{banSlots.map(({ id, slot }) => {
						const ban = bans[slot];
						const banChamp = ban?.championId ? champById.get(ban.championId) : null;
						return banChamp ? (
							<img
								key={banChamp.id}
								src={banChamp.iconUrl}
								alt={banChamp.name}
								title={`밴: ${banChamp.name}`}
								width={32}
								height={32}
								className="size-8 rounded grayscale opacity-70 ring-1 ring-error/40"
								loading="lazy"
								decoding="async"
							/>
						) : (
							<span
								key={id}
								className="size-8 rounded border border-dashed border-base-content/20"
								aria-hidden
							/>
						);
					})}
				</div>
			</div>

			<div className="space-y-1.5">
				{lanes.map((lane) => {
					const pick = game.picks.find((item) => item.team === team && item.role === lane) ?? null;
					const champ = pick?.championId ? champById.get(pick.championId) : null;
					const player = lineup.get(`${team}_${lane}`);
					const playerName = player?.displayName ?? "—";
					const canSelectPlayer = !!(onSelectUser && player?.userId);
					return (
						<div key={lane} className="flex items-center gap-2">
							{champ ? (
								<img
									src={champ.iconUrl}
									alt={champ.name}
									width={40}
									height={40}
									className="w-10 h-10 rounded border border-base-content/20"
									loading="lazy"
									decoding="async"
								/>
							) : (
								<div className="w-10 h-10 rounded bg-base-content/10" />
							)}
							<div className="flex-1 min-w-0">
								<div className="text-[10px] text-base-content/60 uppercase tracking-wide">
									{LANE_LABEL[lane]}
								</div>
								{canSelectPlayer ? (
									<button
										type="button"
										onClick={() => {
											if (player?.userId) onSelectUser?.(player.userId);
										}}
										className="text-sm font-medium truncate text-left hover:text-primary hover:underline transition cursor-pointer w-full"
										title={`${playerName} 프로필 보기`}
									>
										{playerName}
									</button>
								) : (
									<div className="text-sm font-medium truncate">{playerName}</div>
								)}
								{pick && <div className="text-xs text-base-content/70 truncate">{pick.championName}</div>}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
