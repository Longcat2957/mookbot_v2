// 경매내전 BIDDING 매물 hero 아래 — 매물 후보의 추가 정보 카드.
// (1) 라이엇 계정 — 가장 높은 ranked tier + 챔프 mastery top 3. Riot API 호출, 5분 캐시.
// (2) 내전 — 라인별 MMR + 주력 챔프 (DB only, 항상 표시).
// 빈 데이터 (라이엇 계정 미연동 / 내전 기록 없음) 시 빈 상태 placeholder.

import { useCallback } from "react";
import { api } from "../../api/rest.js";
import { useStaleWhileRevalidate } from "../../state/useStaleWhileRevalidate.js";

interface AuctionCardData {
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

export function CandidateInfo({ userId }: { userId: string }) {
	const fetcher = useCallback(() => api<AuctionCardData>(`/users/${userId}/auction-card`), [userId]);
	const swr = useStaleWhileRevalidate<AuctionCardData>(`auction-card:${userId}`, fetcher);

	if (swr.error) {
		return (
			<div className="alert alert-warning text-sm">매물 정보 로딩 실패 — {swr.error}</div>
		);
	}
	if (!swr.data) {
		return (
			<div className="card bg-base-200/60 shadow-sm">
				<div className="card-body p-4">
					<div className="flex items-center gap-2 text-base-content/60">
						<span className="loading loading-spinner loading-sm" />
						매물 정보 로딩 중…
					</div>
				</div>
			</div>
		);
	}

	const { riotAccounts, laneMmrs, topChampions } = swr.data;
	const bestAccount = riotAccounts[0]; // 백엔드에서 정렬됨 — 가장 높은 ranked 우선

	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
			{/* (1) 라이엇 — 가장 높은 ranked + mastery top 3 */}
			<div className="card bg-base-200 shadow-sm">
				<div className="card-body p-4 gap-3">
					<h4 className="text-base font-bold flex items-center gap-2">
						🎮 라이엇 연동
						{bestAccount && (
							<span className="text-sm text-base-content/60 truncate">
								{bestAccount.gameName}#{bestAccount.tagLine}
								{bestAccount.isMain && " (메인)"}
							</span>
						)}
					</h4>

					{!bestAccount ? (
						<div className="text-sm text-base-content/50 py-2">연동된 라이엇 계정 없음</div>
					) : (
						<>
							{/* best ranked */}
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
											{bestAccount.bestRanked.queueType === "RANKED_SOLO_5x5"
												? "솔로랭크"
												: bestAccount.bestRanked.queueType === "RANKED_FLEX_SR"
													? "자유랭크"
													: bestAccount.bestRanked.queueType}
										</div>
										<div
											className={`text-xl font-bold tabular-nums ${
												TIER_COLOR[bestAccount.bestRanked.tier] ?? "text-base-content"
											}`}
										>
											{bestAccount.bestRanked.tier} {bestAccount.bestRanked.rank}{" "}
											<span className="text-sm font-medium">
												{bestAccount.bestRanked.leaguePoints} LP
											</span>
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
								<div className="text-sm text-base-content/50">랭크 기록 없음 (Unranked)</div>
							)}

							{/* mastery top 3 */}
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
												<img
													src={m.iconUrl}
													alt={m.name}
													className="size-12 rounded-md"
													draggable={false}
												/>
												<div className="text-xs font-medium truncate w-full text-center">
													{m.name}
												</div>
												<div className="text-[10px] text-base-content/60 tabular-nums">
													Lv {m.level} · {formatPoints(m.points)}p
												</div>
											</div>
										))}
									</div>
								</div>
							)}
						</>
					)}
				</div>
			</div>

			{/* (2) 내전 — 라인별 MMR + 주력 챔프 */}
			<div className="card bg-base-200 shadow-sm">
				<div className="card-body p-4 gap-3">
					<h4 className="text-base font-bold flex items-center gap-2">⚔️ 내전 기록</h4>

					{/* 라인별 MMR */}
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
									<div className="text-[10px] text-base-content/60">
										{LANE_LABEL[lm.role] ?? lm.role}
									</div>
									<div className="text-sm font-bold tabular-nums">
										{lm.mmr ?? "—"}
									</div>
									<div className="text-[10px] text-base-content/50 tabular-nums">
										{lm.games > 0 ? `${lm.wins}-${lm.losses}` : "0-0"}
									</div>
								</div>
							))}
						</div>
					</div>

					{/* 주력 챔프 */}
					<div className="space-y-1.5">
						<div className="text-xs uppercase tracking-wide text-base-content/60">
							주력 챔프 (내전)
						</div>
						{topChampions.length === 0 ? (
							<div className="text-sm text-base-content/50 py-2">내전 기록 없음</div>
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
											<img
												src={c.iconUrl}
												alt={c.championName}
												className="size-7 rounded"
												draggable={false}
											/>
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
			</div>
		</div>
	);
}
