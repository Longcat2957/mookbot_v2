import { UserAvatar } from "../../components/UserAvatar.js";
import { winrateTextClassDim } from "../../state/winrateColor.js";
import type { LeaderRow } from "./types.js";

interface Props {
	rows: LeaderRow[];
	myUserId: string;
	onSelectUser: (userId: string) => void;
}

export function LeaderboardTable({ rows, myUserId, onSelectUser }: Props) {
	return (
		<div className="overflow-x-auto rounded-lg border border-base-300">
			<table className="table table-sm tabular-nums">
				<thead className="bg-base-200">
					<tr>
						<th className="w-10 text-center">#</th>
						<th>닉네임</th>
						<th className="text-right">MMR</th>
						<th className="text-right">G</th>
						<th className="text-right">W-L</th>
						<th className="text-right">승률</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<LeaderboardRow
							key={row.userId}
							row={row}
							isMe={row.userId === myUserId}
							onSelectUser={onSelectUser}
						/>
					))}
				</tbody>
			</table>
		</div>
	);
}

function LeaderboardRow({
	row,
	isMe,
	onSelectUser,
}: {
	row: LeaderRow;
	isMe: boolean;
	onSelectUser: (userId: string) => void;
}) {
	const medal =
		row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : `${row.rank}`;
	const wrPct = Math.round(row.winrate * 100);

	return (
		// biome-ignore lint/a11y/useSemanticElements: table row keeps table layout while supporting profile navigation.
		<tr
			role="button"
			tabIndex={0}
			aria-label={`${row.rank}위 ${row.displayName} · MMR ${row.mmr} · ${wrPct}% — 프로필 열기`}
			className={`cursor-pointer transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${
				isMe ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-base-200/60"
			}`}
			onClick={() => onSelectUser(row.userId)}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onSelectUser(row.userId);
				}
			}}
		>
			<td className="text-center font-bold">{medal}</td>
			<td className="font-medium">
				<div className="flex items-center gap-2 min-w-0">
					<UserAvatar
						discordId={row.userId}
						displayName={row.displayName}
						imageUrl={
							row.profileIconUrl ?? row.topChampion?.splashUrl ?? row.topChampion?.iconUrl ?? null
						}
						size="sm"
					/>
					<div className="min-w-0">
						<div className="truncate">
							{row.displayName}
							{isMe && (
								<span className="badge badge-primary badge-xs align-middle ml-2 shrink-0">YOU</span>
							)}
							{row.rolesPlayed !== undefined && (
								<span className="text-xs text-base-content/50 shrink-0 ml-2">({row.rolesPlayed}라인)</span>
							)}
						</div>
						{row.topChampion && (
							<div className="text-[10px] text-base-content/50 truncate">
								주력 {row.topChampion.championName}
							</div>
						)}
					</div>
				</div>
			</td>
			<td className="text-right font-bold">{row.mmr}</td>
			<td className="text-right text-base-content/70">{row.games}</td>
			<td className="text-right text-base-content/70">
				<span className="text-info">{row.wins}</span>-<span className="text-error">{row.losses}</span>
			</td>
			<td className={`text-right font-medium ${winrateTextClassDim(wrPct)}`}>{wrPct}%</td>
		</tr>
	);
}
