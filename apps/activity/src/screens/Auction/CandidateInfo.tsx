// 경매내전 BIDDING 매물 정보 — 라이엇 연동 + 내전 기록 두 섹션.
// (1) 라이엇 — 솔로랭크 우선 (자유랭크 fallback) + 챔프 mastery top 3. Riot API, 5분 캐시.
// (2) 내전 — 라인별 MMR + 주력 챔프. DB only, 항상 표시.
//
// 데이터 fetch 는 부모 (BiddingPanel) 에서. 이 파일은 시각화 전담.
// hero (현재 매물) + 두 섹션이 한 카드 안에서 divider 로 묶이도록 wrapper 없이 fragment 반환.

export interface AuctionCardData {
	user: { discordId: string; displayName: string };
	riotAccounts: Array<{
		gameName: string;
		tagLine: string;
		isMain: boolean;
		profileIconUrl: string | null;
		bestRanked: {
			queueType: string;
			tier: string;
			rank: string;
			leaguePoints: number;
			wins: number;
			losses: number;
		} | null;
		masteries: Array<{
			championId: number;
			name: string;
			iconUrl: string;
			points: number;
			level: number;
		}>;
	}>;
	laneMmrs: Array<{
		role: string;
		mmr: number | null;
		games: number;
		wins: number;
		losses: number;
	}>;
	topChampions: Array<{
		championId: number;
		championName: string;
		iconUrl: string;
		plays: number;
		wins: number;
		losses: number;
	}>;
}

const LANE_LABEL: Record<string, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};

const TIER_COLOR: Record<string, string> = {
	CHALLENGER: "text-warning",
	GRANDMASTER: "text-error",
	MASTER: "text-secondary",
	DIAMOND: "text-info",
	EMERALD: "text-success",
	PLATINUM: "text-accent",
	GOLD: "text-warning",
	SILVER: "text-base-content/70",
	BRONZE: "text-base-content/60",
	IRON: "text-base-content/50",
};

function formatPoints(points: number): string {
	if (points >= 1_000_000) return `${(points / 1_000_000).toFixed(1)}M`;
	if (points >= 1_000) return `${(points / 1_000).toFixed(0)}k`;
	return String(points);
}

function queueLabel(q: string): string {
	if (q === "RANKED_SOLO_5x5") return "솔로랭크";
	if (q === "RANKED_FLEX_SR") return "자유랭크";
	return q;
}

export function CandidateRiotSection({
	data,
	error,
}: {
	data: AuctionCardData | null;
	error: string | null;
}) {
	if (error) {
		return <div className="alert alert-warning text-sm">라이엇 정보 로딩 실패 — {error}</div>;
	}
	if (!data) {
		return (
			<div className="flex items-center gap-2 text-base-content/60 text-sm">
				<span className="loading loading-spinner loading-sm" />
				라이엇 정보 로딩 중…
			</div>
		);
	}

	const bestAccount = data.riotAccounts[0];

	if (!bestAccount) {
		return <div className="text-sm text-base-content/50">연동된 라이엇 계정 없음</div>;
	}

	return (
		<div className="space-y-3">
			<div className="text-xs text-base-content/60 truncate">
				{bestAccount.gameName}#{bestAccount.tagLine}
				{bestAccount.isMain && " (메인)"}
			</div>

			{bestAccount.bestRanked ? (
				<div className="flex items-center gap-3 bg-base-100/40 rounded-md p-2.5">
					{bestAccount.profileIconUrl && (
						<img
							src={bestAccount.profileIconUrl}
							alt=""
							className="size-12 rounded-md ring-1 ring-base-content/10"
							draggable={false}
						/>
					)}
					<div className="flex-1 min-w-0">
						<div className="text-xs text-base-content/60">
							{queueLabel(bestAccount.bestRanked.queueType)}
						</div>
						<div
							className={`text-xl font-bold tabular-nums ${
								TIER_COLOR[bestAccount.bestRanked.tier] ?? "text-base-content"
							}`}
						>
							{bestAccount.bestRanked.tier} {bestAccount.bestRanked.rank}{" "}
							<span className="text-sm font-medium">{bestAccount.bestRanked.leaguePoints} LP</span>
						</div>
						<div className="text-xs text-base-content/60 tabular-nums">
							{bestAccount.bestRanked.wins}W {bestAccount.bestRanked.losses}L ·{" "}
							{(
								(bestAccount.bestRanked.wins /
									Math.max(1, bestAccount.bestRanked.wins + bestAccount.bestRanked.losses)) *
								100
							).toFixed(0)}
							%
						</div>
					</div>
				</div>
			) : (
				<div className="text-sm text-base-content/50">솔로랭크 미배치 (Unranked)</div>
			)}

			{bestAccount.masteries.length > 0 && (
				<div className="space-y-1.5">
					<div className="text-xs uppercase tracking-wide text-base-content/60">
						🏆 챔프 숙련도 TOP 3
					</div>
					<div className="grid grid-cols-3 gap-2">
						{bestAccount.masteries.map((m) => (
							<div
								key={m.championId}
								className="flex flex-col items-center gap-1 bg-base-100/40 rounded-md p-1.5"
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
			)}
		</div>
	);
}

export function CandidateMookSection({ data }: { data: AuctionCardData | null }) {
	if (!data) {
		return null; // 부모가 라이엇 섹션에서 로딩 표시 — 중복 표시 X
	}

	const { laneMmrs, topChampions } = data;

	return (
		<div className="space-y-3">
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
									className="flex items-center gap-1.5 bg-base-100/40 rounded-md px-1.5 py-1"
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
		</div>
	);
}
