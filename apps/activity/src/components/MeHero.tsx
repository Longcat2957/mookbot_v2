// 대시보드 상단 본인 요약 카드 — op.gg 스타일 me-hero.
// /api/users/:me/profile 에서 라인별 MMR + 시즌 + 총 W/L 가져와 카드 한 장으로 표시.
// 클릭 시 본인 프로필 진입.

import { useCallback } from "react";
import { api } from "../api/rest.js";
import { usePerms } from "../state/perms.js";
import { useStaleWhileRevalidate } from "../state/useStaleWhileRevalidate.js";
import { UserAvatar } from "./UserAvatar.js";

const ROLE_LABEL: Record<string, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};

const ROLE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;

interface RiotAccount {
	gameName: string;
	tagLine: string;
	isMain: boolean;
	profileIconUrl: string | null;
}

interface LaneMmr {
	role: string;
	mmr: number | null;
	games: number;
	wins: number;
	losses: number;
	winrate: number;
}

interface TopChampion {
	championId: number;
	championName: string;
	iconUrl: string;
	splashUrl: string;
	plays: number;
}

interface MeProfileResponse {
	user: { discordId: string; displayName: string; profileIconUrl: string | null };
	riotAccounts: RiotAccount[];
	season: { id: number; name: string };
	laneMmrs: LaneMmr[];
	totals: { games: number; wins: number; losses: number; winrate: number };
	topChampions: TopChampion[];
}

export function MeHero({ onSelectMe }: { onSelectMe: () => void }) {
	const perms = usePerms();
	const userId = perms.discordId;

	const fetcher = useCallback(() => api<MeProfileResponse>(`/users/${userId}/profile`), [userId]);
	const swr = useStaleWhileRevalidate<MeProfileResponse>(`me-hero:${userId}`, fetcher, {
		debounceMs: 200,
		enabled: !!userId,
	});

	if (!userId) return null;
	if (swr.error) {
		// 신규 사용자가 users 행 없는 등 — Hero 만 조용히 숨김 (대시보드 자체는 OK)
		return null;
	}

	if (!swr.data) {
		return <div className="skeleton h-36 w-full rounded-box" />;
	}

	const { user, riotAccounts, season, totals, laneMmrs, topChampions } = swr.data;
	const mainRiot = riotAccounts.find((a) => a.isMain);
	// 우선순위: 소환사 아이콘 (RP/BE 구매) → 챔프 splash → 챔프 icon → placeholder
	const avatarUrl =
		user.profileIconUrl ?? topChampions[0]?.splashUrl ?? topChampions[0]?.iconUrl ?? null;
	const mainChampName = topChampions[0]?.championName;
	const wrPct = totals.games > 0 ? Math.round(totals.winrate * 100) : null;
	const wrColor =
		wrPct === null
			? "text-base-content/50"
			: wrPct >= 60
				? "text-success"
				: wrPct >= 50
					? "text-info"
					: wrPct >= 40
						? "text-base-content/70"
						: "text-error";

	const sortedMmrs = [...laneMmrs].sort(
		(a, b) =>
			ROLE_ORDER.indexOf(a.role as (typeof ROLE_ORDER)[number]) -
			ROLE_ORDER.indexOf(b.role as (typeof ROLE_ORDER)[number]),
	);

	return (
		<button
			type="button"
			onClick={onSelectMe}
			className="card bg-gradient-to-br from-base-200 to-base-200/60 border border-base-300 shadow-sm hover:border-primary/40 hover:shadow-md transition text-left w-full"
			aria-label="내 프로필 열기"
		>
			<div className="card-body p-4 sm:p-5 gap-3">
				<div className="flex items-start justify-between gap-3 flex-wrap">
					<div className="flex items-start gap-3 min-w-0 flex-1">
						<UserAvatar
							discordId={user.discordId}
							displayName={user.displayName}
							imageUrl={avatarUrl}
							size="lg"
							ring
						/>
						<div className="min-w-0 flex-1">
							<div className="text-[10px] uppercase tracking-wider text-base-content/50">내 프로필</div>
							<h2 className="text-2xl font-bold leading-tight truncate flex items-center gap-2 mt-0.5">
								<span className="truncate">{user.displayName}</span>
								<span className="badge badge-primary badge-xs">YOU</span>
							</h2>
							{mainRiot && (
								<div className="text-sm text-base-content/70 truncate tabular-nums mt-0.5">
									{mainRiot.gameName}
									<span className="opacity-50">#{mainRiot.tagLine}</span>
								</div>
							)}
							{mainChampName && (
								<div className="text-xs text-base-content/50 truncate mt-0.5">
									주력 <span className="font-medium text-base-content/70">{mainChampName}</span>
								</div>
							)}
						</div>
					</div>

					<div className="text-right text-xs shrink-0">
						<div className="text-base-content/50">시즌</div>
						<div className="font-medium">{season.name || `S${season.id}`}</div>
						{totals.games > 0 ? (
							<div className="mt-2 tabular-nums">
								<span className="text-info font-bold">{totals.wins}</span>
								<span className="opacity-30 mx-0.5">·</span>
								<span className="text-error font-bold">{totals.losses}</span>
								<span className={`ml-1.5 font-bold ${wrColor}`}>{wrPct}%</span>
							</div>
						) : (
							<div className="mt-2 text-base-content/40">기록 없음</div>
						)}
					</div>
				</div>

				{/* 라인별 MMR 5칸 */}
				<div className="grid grid-cols-5 gap-1.5">
					{sortedMmrs.map((m) => {
						const empty = m.mmr === null;
						const lanePct = !empty && m.games > 0 ? Math.round(m.winrate * 100) : null;
						const laneWrColor =
							lanePct === null
								? "text-base-content/40"
								: lanePct >= 60
									? "text-success"
									: lanePct >= 50
										? "text-info"
										: lanePct >= 40
											? "text-base-content/60"
											: "text-error";
						return (
							<div
								key={m.role}
								className={`rounded-md p-1.5 text-center ${empty ? "bg-base-100/30" : "surface-quiet"}`}
							>
								<div className="text-[9px] uppercase tracking-wide text-base-content/60">
									{ROLE_LABEL[m.role] ?? m.role}
								</div>
								<div
									className={`text-lg font-bold tabular-nums leading-none mt-0.5 ${empty ? "text-base-content/30" : ""}`}
								>
									{m.mmr ?? "—"}
								</div>
								<div className="text-[9px] tabular-nums leading-tight mt-0.5">
									{empty ? (
										<span className="text-base-content/30">—</span>
									) : (
										<>
											<span className="text-base-content/50">{m.games}G</span>
											{lanePct !== null && (
												<span className={`ml-1 font-medium ${laneWrColor}`}>{lanePct}%</span>
											)}
										</>
									)}
								</div>
							</div>
						);
					})}
				</div>

				<div className="text-xs text-base-content/50 text-right">자세히 →</div>
			</div>
		</button>
	);
}
