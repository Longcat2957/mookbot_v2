import { type AuctionCardData, LANE_LABEL } from "./candidateInfoTypes.js";

export function CandidateMookDetails({ data }: { data: AuctionCardData }) {
	return (
		<div className="space-y-3">
			<LaneMmrGrid laneMmrs={data.laneMmrs} />
			<MookChampionList topChampions={data.topChampions} />
		</div>
	);
}

function LaneMmrGrid({ laneMmrs }: { laneMmrs: AuctionCardData["laneMmrs"] }) {
	return (
		<div className="space-y-1">
			<div className="text-xs uppercase tracking-wide text-base-content/60">라인별 MMR</div>
			<div className="grid grid-cols-5 gap-1.5">
				{laneMmrs.map((lm) => (
					<div
						key={lm.role}
						className={`flex flex-col items-center gap-0.5 rounded-md p-1.5 ${
							lm.mmr != null ? "bg-base-100/60" : "bg-base-100/20 opacity-60"
						}`}
					>
						<div className="text-[10px] text-base-content/60">{LANE_LABEL[lm.role] ?? lm.role}</div>
						<div className="text-sm font-bold tabular-nums">{lm.mmr ?? "—"}</div>
						<div className="text-[10px] text-base-content/50 tabular-nums">
							{lm.games > 0 ? `${lm.wins}-${lm.losses}` : "0-0"}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function MookChampionList({ topChampions }: { topChampions: AuctionCardData["topChampions"] }) {
	return (
		<div className="space-y-1.5">
			<div className="text-xs uppercase tracking-wide text-base-content/60">주력 챔프 (내전)</div>
			{topChampions.length === 0 ? (
				<div className="text-sm text-base-content/50 py-1">내전 기록 없음</div>
			) : (
				<div className="flex flex-wrap gap-1.5">
					{topChampions.slice(0, 8).map((c) => {
						const wr = c.plays > 0 ? Math.round((c.wins / c.plays) * 100) : 0;
						return (
							<div
								key={c.championId}
								className="flex items-center gap-1.5 surface-quiet-soft rounded-md px-1.5 py-1"
								title={`${c.championName} · ${c.plays}경기 (${c.wins}W ${c.losses}L · ${wr}%)`}
							>
								<img src={c.iconUrl} alt={c.championName} className="size-7 rounded" draggable={false} />
								<div className="text-xs leading-tight">
									<div className="font-medium truncate max-w-[5rem]">{c.championName}</div>
									<div className="text-[10px] text-base-content/60 tabular-nums">
										{c.plays}회 · {wr}%
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
