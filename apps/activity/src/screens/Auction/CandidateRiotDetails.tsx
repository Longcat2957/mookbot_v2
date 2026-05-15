import {
	type AuctionCardData,
	formatPoints,
	queueLabel,
	TIER_COLOR,
} from "./candidateInfoTypes.js";

type RiotAccount = AuctionCardData["riotAccounts"][number];

export function CandidateRiotDetails({ account }: { account: RiotAccount }) {
	return (
		<div className="space-y-3">
			<div className="text-xs text-base-content/60 truncate">
				{account.gameName}#{account.tagLine}
				{account.isMain && " (메인)"}
			</div>
			<RiotRankCard account={account} />
			<RiotMasteries account={account} />
		</div>
	);
}

function RiotRankCard({ account }: { account: RiotAccount }) {
	if (!account.bestRanked) {
		return <div className="text-sm text-base-content/50">솔로랭크 미배치 (Unranked)</div>;
	}

	const ranked = account.bestRanked;
	const winrate = ((ranked.wins / Math.max(1, ranked.wins + ranked.losses)) * 100).toFixed(0);

	return (
		<div className="flex items-center gap-3 surface-quiet-soft rounded-md p-2.5">
			{account.profileIconUrl && (
				<img
					src={account.profileIconUrl}
					alt=""
					className="size-12 rounded-md ring-1 ring-base-content/10"
					draggable={false}
				/>
			)}
			<div className="flex-1 min-w-0">
				<div className="text-xs text-base-content/60">{queueLabel(ranked.queueType)}</div>
				<div
					className={`text-xl font-bold tabular-nums ${TIER_COLOR[ranked.tier] ?? "text-base-content"}`}
				>
					{ranked.tier} {ranked.rank}{" "}
					<span className="text-sm font-medium">{ranked.leaguePoints} LP</span>
				</div>
				<div className="text-xs text-base-content/60 tabular-nums">
					{ranked.wins}W {ranked.losses}L · {winrate}%
				</div>
			</div>
		</div>
	);
}

function RiotMasteries({ account }: { account: RiotAccount }) {
	if (account.masteries.length === 0) return null;

	return (
		<div className="space-y-1.5">
			<div className="text-xs uppercase tracking-wide text-base-content/60">🏆 챔프 숙련도 TOP 3</div>
			<div className="grid grid-cols-3 gap-2">
				{account.masteries.map((m) => (
					<div
						key={m.championId}
						className="flex flex-col items-center gap-1 surface-quiet-soft rounded-md p-1.5"
					>
						<img src={m.iconUrl} alt={m.name} className="size-12 rounded-md" draggable={false} />
						<div className="text-xs font-medium truncate w-full text-center">{m.name}</div>
						<div className="text-[10px] text-base-content/60 tabular-nums">
							Lv {m.level} · {formatPoints(m.points)}p
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
