// 유저 프로필 — 라인별 MMR + MMR 시계열 그래프 + 최근 20게임 + 주력 챔프.
// 진입점: 리더보드 행 클릭, 시리즈 라인업 멤버 클릭, navbar 본인 메뉴.
//
// WS 토픽: user:<userId> 구독 — 게임 기록 시 background refresh.

import { useCallback, useEffect } from "react";
import { api } from "../api/rest.js";
import { wsClient } from "../api/ws.js";
import { showToast } from "../components/Toaster.js";
import { UserAvatar } from "../components/UserAvatar.js";
import { usePerms } from "../state/perms.js";
import { useStaleWhileRevalidate } from "../state/useStaleWhileRevalidate.js";
import { winrateTextClass, winrateTextClassDim } from "../state/winrateColor.js";
import { MmrChart } from "./Profile/MmrChart.js";
import { Preferences } from "./Profile/Preferences.js";

const ROLE_LABEL: Record<string, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};

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
	wins: number;
	losses: number;
	winrate: number;
}

interface RecentGame {
	gameId: number;
	seriesId: number;
	gameNumber: number;
	playedAt: number;
	team: "TEAM_1" | "TEAM_2";
	role: string;
	side: "BLUE" | "RED";
	championId: number | null;
	championName: string | null;
	iconUrl: string | null;
	won: boolean;
	mmrDelta: number | null;
	mmrAfter: number | null;
}

interface ProfileResponse {
	user: { discordId: string; displayName: string; profileIconUrl: string | null };
	riotAccounts: RiotAccount[];
	season: { id: number; name: string };
	laneMmrs: LaneMmr[];
	totals: { games: number; wins: number; losses: number; winrate: number };
	topChampions: TopChampion[];
	recentGames: RecentGame[];
}

export function Profile({
	userId,
	onBack,
	onSelectSeries,
	onManageRiotAccounts,
}: {
	userId: string;
	onBack: () => void;
	onSelectSeries: (seriesId: number) => void;
	onManageRiotAccounts?: () => void;
}) {
	const perms = usePerms();
	const isMe = perms.discordId === userId;

	const fetcher = useCallback(() => api<ProfileResponse>(`/users/${userId}/profile`), [userId]);
	const swr = useStaleWhileRevalidate<ProfileResponse>(`profile:${userId}`, fetcher, {
		debounceMs: 150,
	});

	useEffect(() => {
		return wsClient.subscribe(`user:${userId}`, () => {
			swr.refresh();
			showToast("프로필이 업데이트되었습니다");
		});
	}, [userId, swr]);

	const data = swr.data;
	const error = swr.error;

	if (error) {
		return (
			<section className="space-y-3">
				<div className="alert alert-error">
					<span>프로필을 불러오지 못했습니다: {error}</span>
				</div>
				<button type="button" className="btn btn-sm btn-outline" onClick={onBack}>
					← 돌아가기
				</button>
			</section>
		);
	}
	if (!data) {
		return (
			<section className="space-y-3">
				<div className="skeleton h-12 w-64" />
				<div className="skeleton h-32 w-full" />
				<div className="skeleton h-48 w-full" />
			</section>
		);
	}

	const totalWrPct = Math.round(data.totals.winrate * 100);

	return (
		<section className="space-y-4">
			{/* 헤더 */}
			<div className="flex items-start justify-between gap-3 flex-wrap">
				<div className="flex items-start gap-3 min-w-0 flex-1">
					<UserAvatar
						discordId={data.user.discordId}
						displayName={data.user.displayName}
						imageUrl={
							data.user.profileIconUrl ??
							data.topChampions[0]?.iconUrl ??
							data.topChampions[0]?.splashUrl ??
							null
						}
						size="xl"
						ring={isMe}
					/>
					<div className="min-w-0">
						<h1 className="text-2xl font-bold flex items-center gap-2">
							<span className="truncate">{data.user.displayName}</span>
							{isMe && <span className="badge badge-primary badge-sm">YOU</span>}
						</h1>
						<div className="text-sm text-base-content/70 flex items-center gap-2 flex-wrap mt-1">
							<span>시즌 {data.season.id}</span>
							<span className="opacity-30">·</span>
							<span>
								총 <span className="font-bold tabular-nums">{data.totals.games}</span>G ·{" "}
								<span className="text-info tabular-nums">{data.totals.wins}</span>승{" "}
								<span className="text-error tabular-nums">{data.totals.losses}</span>패{" "}
								{data.totals.games > 0 && (
									<span
										className={`font-medium ${
											totalWrPct >= 60
												? "text-success"
												: totalWrPct >= 50
													? "text-info"
													: totalWrPct >= 40
														? "text-base-content/70"
														: "text-error"
										}`}
									>
										({totalWrPct}%)
									</span>
								)}
							</span>
						</div>
						<div className="flex flex-wrap gap-1.5 mt-2 items-center">
							{data.riotAccounts.map((a) => (
								<span
									key={`${a.gameName}#${a.tagLine}`}
									className={`badge badge-sm ${a.isMain ? "badge-warning" : "badge-ghost"}`}
								>
									{a.isMain && "⭐ "}
									{a.gameName}#{a.tagLine}
								</span>
							))}
							{isMe && onManageRiotAccounts && (
								<button
									type="button"
									className="btn btn-xs btn-ghost"
									onClick={onManageRiotAccounts}
									title="라이엇 계정 추가 / 메인 전환 / 해제"
								>
									✏️ 관리
								</button>
							)}
						</div>
					</div>
				</div>
				<button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
					← 돌아가기
				</button>
			</div>

			{/* 라인별 MMR 카드 5개 */}
			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
				{data.laneMmrs.map((m) => (
					<LaneMmrCard key={m.role} mmr={m} />
				))}
			</div>

			{/* 라인별 선호 챔프 (게시판 텍스트 풀이의 페이지 대체) */}
			<details className="surface-soft rounded-lg" open>
				<summary className="cursor-pointer text-sm font-medium px-3 py-2 select-none flex items-center gap-2">
					📌 선호 챔프
					{isMe && <span className="badge badge-ghost badge-xs">편집 가능</span>}
				</summary>
				<div className="px-3 pb-3 pt-1">
					<Preferences userId={userId} isMe={isMe} />
				</div>
			</details>

			{/* MMR 시계열 그래프 */}
			<details className="surface-soft rounded-lg">
				<summary className="cursor-pointer text-sm font-medium px-3 py-2 select-none">
					📈 MMR 추이
				</summary>
				<div className="px-3 pb-3 pt-1">
					<MmrChart userId={userId} />
				</div>
			</details>

			{/* 주력 챔프 + 최근 게임 */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<div className="card surface-soft">
					<div className="card-body p-3">
						<h2 className="card-title text-base">🌟 주력 챔프</h2>
						{data.topChampions.length === 0 ? (
							<div className="text-sm text-base-content/50 py-2">아직 픽 기록이 없습니다.</div>
						) : (
							<ul className="space-y-1.5">
								{data.topChampions.map((c) => {
									const wrPct = Math.round(c.winrate * 100);
									return (
										<li key={c.championId} className="flex items-center gap-2.5">
											<img src={c.iconUrl} alt={c.championName} className="w-9 h-9 rounded" loading="lazy" />
											<div className="flex-1 min-w-0">
												<div className="font-medium truncate text-sm">{c.championName}</div>
												<div className="text-xs text-base-content/60 tabular-nums">
													{c.plays}G · {c.wins}-{c.losses} ({wrPct}%)
												</div>
											</div>
										</li>
									);
								})}
							</ul>
						)}
					</div>
				</div>

				<div className="card surface-soft">
					<div className="card-body p-3">
						<h2 className="card-title text-base">🕒 최근 게임</h2>
						{data.recentGames.length === 0 ? (
							<div className="text-sm text-base-content/50 py-2">최근 게임 기록이 없습니다.</div>
						) : (
							<ul className="space-y-1.5 max-h-[50vh] sm:max-h-[420px] overflow-y-auto pr-1">
								{data.recentGames.map((g) => (
									<RecentGameItem key={g.gameId} g={g} onClick={() => onSelectSeries(g.seriesId)} />
								))}
							</ul>
						)}
					</div>
				</div>
			</div>
		</section>
	);
}

function LaneMmrCard({ mmr }: { mmr: LaneMmr }) {
	const wrPct = Math.round(mmr.winrate * 100);
	const empty = mmr.mmr === null;
	const radialColor = winrateTextClass(wrPct);
	return (
		<div
			className={`rounded-lg p-3 border ${empty ? "border-base-300 bg-base-200/30 opacity-60" : "border-base-300 bg-base-100"}`}
		>
			<div className="flex items-center justify-between">
				<div className="text-[10px] uppercase tracking-wide text-base-content/60">
					{ROLE_LABEL[mmr.role] ?? mmr.role}
				</div>
				{!empty && mmr.games > 0 && (
					<div
						className={`radial-progress ${radialColor} text-[9px] font-bold tabular-nums`}
						style={
							{
								"--value": wrPct,
								"--size": "1.75rem",
								"--thickness": "2px",
							} as React.CSSProperties
						}
						role="progressbar"
						aria-valuenow={wrPct}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-label={`${ROLE_LABEL[mmr.role] ?? mmr.role} 라인 승률 ${wrPct}%`}
					>
						{wrPct}
					</div>
				)}
			</div>
			{empty ? (
				<div className="text-base-content/40 text-sm mt-1">기록 없음</div>
			) : (
				<>
					<div className="text-2xl font-bold leading-tight tabular-nums mt-0.5">{mmr.mmr}</div>
					<div className="text-xs text-base-content/60 tabular-nums">
						{mmr.games}G · <span className={winrateTextClassDim(wrPct)}>{wrPct}%</span>
					</div>
				</>
			)}
		</div>
	);
}

function RecentGameItem({ g, onClick }: { g: RecentGame; onClick: () => void }) {
	// K/D/A · CS 는 Riot production key / tournament API 인증 전까지 수집 불가 — UI 미표시.
	const sideColor = g.side === "BLUE" ? "text-info" : "text-error";
	return (
		<li>
			<button
				type="button"
				onClick={onClick}
				className="w-full flex items-center gap-2 text-left p-1.5 rounded hover:bg-base-200/60 transition"
			>
				{g.iconUrl ? (
					<img src={g.iconUrl} alt={g.championName ?? ""} className="w-9 h-9 rounded" loading="lazy" />
				) : (
					<div className="w-9 h-9 rounded bg-base-300" />
				)}
				<div className="flex-1 min-w-0 leading-tight">
					<div className="flex items-center gap-1.5 text-xs">
						<span className={`font-bold ${g.won ? "text-info" : "text-error"}`}>{g.won ? "W" : "L"}</span>
						<span className="text-base-content/60">
							시리즈 #{g.seriesId} · G{g.gameNumber}
						</span>
						<span className={`${sideColor} ml-auto font-medium`}>{g.side}</span>
					</div>
					<div className="text-sm font-medium truncate">{g.championName ?? "—"}</div>
					<div className="text-xs text-base-content/60 tabular-nums flex items-center gap-2">
						{g.mmrDelta !== null && (
							<span className={`ml-auto font-semibold ${g.mmrDelta > 0 ? "text-info" : "text-error"}`}>
								{g.mmrDelta > 0 ? "+" : ""}
								{g.mmrDelta}
							</span>
						)}
					</div>
				</div>
			</button>
		</li>
	);
}
