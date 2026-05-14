// 지난 내전 결과 화면 (read-only) — 종료된 시리즈의 게임별 픽/밴 + 승자 + 라인업.

import { useCallback, useMemo } from "react";
import { api } from "../api/rest.js";
import { type LineupParticipant, LineupPreview } from "../components/LineupPreview.js";
import { useStaleWhileRevalidate } from "../state/useStaleWhileRevalidate.js";

type Team = "TEAM_1" | "TEAM_2";
type Side = "BLUE" | "RED";

interface Champion {
	id: number;
	idSlug: string;
	name: string;
	iconUrl: string;
}

interface GameDetail {
	id: number;
	gameNumber: number;
	team1Side: Side;
	winningTeam: Team;
	durationSec: number | null;
	picks: { team: Team; role: string; championName: string; championId: number | null }[];
	bans: { team: Team; position: number; championName: string; championId: number | null }[];
}

interface SeriesDetail {
	series: {
		id: number;
		status: string;
		startedAt: number;
		winningTeam: Team | null;
	};
	participants: LineupParticipant[];
	games: GameDetail[];
}

const LANE_LABEL: Record<string, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};
const LANE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;

export function SeriesResult({
	seriesId,
	onBack,
	onSelectUser,
}: {
	seriesId: number | null;
	onBack: () => void;
	onSelectUser?: (userId: string) => void;
}) {
	// SWR — read-only 화면이라 dirty 보호 불필요. setDetail(null) 제거로 플리커
	// 만 차단 (hot_fix.md §3.5).
	const detailFetcher = useCallback(() => api<SeriesDetail>(`/series/${seriesId}`), [seriesId]);
	const detailSwr = useStaleWhileRevalidate<SeriesDetail>(seriesId, detailFetcher, {
		debounceMs: 150,
		enabled: seriesId !== null,
	});
	const champFetcher = useCallback(
		() => api<{ champions: Champion[] }>("/champions").then((r) => r.champions),
		[],
	);
	const champSwr = useStaleWhileRevalidate<Champion[]>("champions", champFetcher);
	const detail = detailSwr.data;
	const error = detailSwr.error;
	const champions = useMemo(() => champSwr.data ?? [], [champSwr.data]);
	// id → Champion 인덱스. champions 가 동일하면 재계산 안 함.
	// hooks 순서 위해 early return 위에 위치.
	const champById = useMemo(() => {
		const m = new Map<number, Champion>();
		for (const c of champions) m.set(c.id, c);
		return m;
	}, [champions]);

	if (seriesId === null) {
		return (
			<div className="alert alert-warning">
				<span>시리즈를 선택하세요.</span>
			</div>
		);
	}
	if (error) {
		return (
			<div className="space-y-3">
				<div className="alert alert-error">
					<span>{error}</span>
				</div>
				<button type="button" className="btn btn-sm" onClick={onBack}>
					← 대시보드
				</button>
			</div>
		);
	}
	if (!detail) return <SeriesResultSkeleton />;

	let t1Wins = 0;
	let t2Wins = 0;
	for (const g of detail.games) {
		if (g.winningTeam === "TEAM_1") t1Wins++;
		else if (g.winningTeam === "TEAM_2") t2Wins++;
	}
	const teamSize = detail.participants.length / 2;

	const startedDate = new Date(detail.series.startedAt * 1000);
	const dateLabel = `${startedDate.getMonth() + 1}월 ${startedDate.getDate()}일 ${String(startedDate.getHours()).padStart(2, "0")}:${String(startedDate.getMinutes()).padStart(2, "0")}`;

	return (
		<section className="space-y-4">
			<div className="flex items-center justify-between flex-wrap gap-2">
				<button type="button" className="btn btn-sm btn-ghost" onClick={onBack}>
					← 대시보드
				</button>
				<div className="text-xs text-base-content/60">
					시리즈 #{detail.series.id} · {teamSize}v{teamSize} · {dateLabel}
				</div>
			</div>

			{/* Hero mini — 스코어 + 우승 트로피 */}
			<div
				className={`card surface-base shadow-sm ${
					detail.series.winningTeam ? "border border-success" : ""
				}`}
			>
				<div className="card-body p-5 items-center text-center gap-2">
					{detail.series.winningTeam && (
						<div className="text-3xl text-success leading-none" aria-hidden>
							🏆
						</div>
					)}
					<div className="flex items-end gap-4 tabular-nums">
						<TeamScore
							label="1팀"
							wins={t1Wins}
							won={detail.series.winningTeam === "TEAM_1"}
							color="text-info"
						/>
						<div className="text-3xl opacity-30 leading-none pb-2">:</div>
						<TeamScore
							label="2팀"
							wins={t2Wins}
							won={detail.series.winningTeam === "TEAM_2"}
							color="text-error"
						/>
					</div>
					{detail.series.winningTeam && (
						<div className="text-sm font-bold text-success mt-1">
							{detail.series.winningTeam === "TEAM_1" ? "1팀" : "2팀"} 우승
						</div>
					)}
				</div>
			</div>

			<details className="collapse collapse-arrow bg-base-200">
				<summary className="collapse-title text-sm font-medium py-2 min-h-0 px-4">라인업 보기</summary>
				<div className="collapse-content px-4">
					<LineupPreview
						participants={detail.participants}
						{...(onSelectUser ? { onSelectUser } : {})}
					/>
				</div>
			</details>

			{detail.games.length === 0 ? (
				<div className="alert">
					<span>기록된 게임이 없습니다.</span>
				</div>
			) : (
				(() => {
					const sortedGames = detail.games.slice().sort((a, b) => a.gameNumber - b.gameNumber);
					return (
						<ul className="timeline timeline-vertical timeline-compact">
							{sortedGames.map((g, i) => {
								const isLast = i === sortedGames.length - 1;
								const dotColor = g.winningTeam === "TEAM_1" ? "bg-info" : "bg-error";
								return (
									<li key={g.id}>
										{i > 0 && <hr className="bg-base-300" />}
										<div className="timeline-middle">
											<div
												className={`size-3 rounded-full ${dotColor} ring-2 ring-base-100`}
												aria-hidden="true"
											/>
										</div>
										<div className="timeline-end pb-2 w-full">
											<GameSummaryCard game={g} participants={detail.participants} champById={champById} />
										</div>
										{!isLast && <hr className="bg-base-300" />}
									</li>
								);
							})}
						</ul>
					);
				})()
			)}
		</section>
	);
}

function TeamScore({
	label,
	wins,
	won,
	color,
}: {
	label: string;
	wins: number;
	won: boolean;
	color: string;
}) {
	return (
		<div className="text-center">
			<div className={`text-xs uppercase ${color}`}>{label}</div>
			<div className={`text-3xl font-bold tabular-nums ${won ? "text-success" : ""}`}>{wins}</div>
		</div>
	);
}

function GameSummaryCard({
	game,
	participants,
	champById,
}: {
	game: GameDetail;
	participants: LineupParticipant[];
	champById: Map<number, Champion>;
}) {
	const lineup = new Map<string, string>();
	for (const p of participants) lineup.set(`${p.team}_${p.role}`, p.displayName);

	const teamSize = participants.length / 2;
	const lanes = LANE_ORDER.slice(0, teamSize);

	const pickFor = (team: Team, role: string) =>
		game.picks.find((p) => p.team === team && p.role === role) ?? null;

	// LoL 관습: BLUE 좌 / RED 우
	const blueTeam: Team = game.team1Side === "BLUE" ? "TEAM_1" : "TEAM_2";
	const redTeam: Team = blueTeam === "TEAM_1" ? "TEAM_2" : "TEAM_1";

	const bansFor = (team: Team) =>
		game.bans.filter((b) => b.team === team).sort((a, b) => a.position - b.position);

	const duration = game.durationSec
		? `${Math.floor(game.durationSec / 60)}분 ${game.durationSec % 60}초`
		: null;

	const winnerLabel = game.winningTeam === "TEAM_1" ? "1팀" : "2팀";
	const winnerSide = game.winningTeam === blueTeam ? "BLUE" : "RED";

	return (
		<details className="collapse collapse-arrow bg-base-200" open>
			<summary className="collapse-title min-h-0 py-3 px-4 flex items-center justify-between gap-2 flex-wrap">
				<div className="flex items-center gap-2">
					<span className="font-bold text-base">Game {game.gameNumber}</span>
					<span className="badge badge-success badge-sm">
						{winnerLabel} 승 ({winnerSide})
					</span>
				</div>
				<div className="text-xs text-base-content/60 flex items-center gap-2">
					{duration && <span>⏱ {duration}</span>}
				</div>
			</summary>
			<div className="collapse-content px-4 pb-4">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					{[blueTeam, redTeam].map((team) => {
						const isWinner = game.winningTeam === team;
						const teamLabel = team === "TEAM_1" ? "1팀" : "2팀";
						const side = team === blueTeam ? "BLUE" : "RED";
						const sideTone = side === "BLUE" ? "info" : "error";
						const bans = bansFor(team);
						return (
							<div
								key={team}
								className={`relative rounded-lg p-3 ${
									isWinner ? "border border-success bg-success/5" : "surface-quiet-soft"
								}`}
							>
								{isWinner && (
									<span className="absolute top-2 right-2 badge badge-success badge-sm">WIN</span>
								)}
								<div className="flex items-center gap-2 mb-2">
									<span className={`badge badge-sm ${sideTone === "info" ? "badge-info" : "badge-error"}`}>
										{side}
									</span>
									<span className="font-bold">{teamLabel}</span>
								</div>

								{/* 밴 5개 */}
								<div className="mb-3">
									<div className="text-[10px] uppercase tracking-wide text-base-content/50 mb-1">밴</div>
									<div className="flex gap-1">
										{Array.from({ length: teamSize }).map((_, i) => {
											const ban = bans[i];
											const banChamp = ban?.championId ? champById.get(ban.championId) : null;
											return banChamp ? (
												<img
													key={i}
													src={banChamp.iconUrl}
													alt={banChamp.name}
													title={`밴: ${banChamp.name}`}
													className="size-8 rounded grayscale opacity-70 ring-1 ring-error/40"
												/>
											) : (
												<span
													key={i}
													className="size-8 rounded border border-dashed border-base-content/20"
													aria-hidden
												/>
											);
										})}
									</div>
								</div>

								{/* 픽 라인업 */}
								<div className="space-y-1.5">
									{lanes.map((lane) => {
										const pick = pickFor(team, lane);
										const champ = pick?.championId ? champById.get(pick.championId) : null;
										const player = lineup.get(`${team}_${lane}`) ?? "—";
										return (
											<div key={lane} className="flex items-center gap-2">
												{champ ? (
													<img
														src={champ.iconUrl}
														alt={champ.name}
														className="w-10 h-10 rounded border border-base-content/20"
													/>
												) : (
													<div className="w-10 h-10 rounded bg-base-content/10" />
												)}
												<div className="flex-1 min-w-0">
													<div className="text-[10px] text-base-content/60 uppercase tracking-wide">
														{LANE_LABEL[lane]}
													</div>
													<div className="text-sm font-medium truncate">{player}</div>
													{pick && (
														<div className="text-xs text-base-content/70 truncate">{pick.championName}</div>
													)}
												</div>
											</div>
										);
									})}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</details>
	);
}

function SeriesResultSkeleton() {
	return (
		<section className="space-y-4">
			<div className="flex items-center justify-between">
				<div className="space-y-2">
					<div className="skeleton h-7 w-48" />
					<div className="skeleton h-4 w-32" />
				</div>
				<div className="skeleton h-8 w-24" />
			</div>
			<div className="skeleton h-24 w-full" />
			<div className="skeleton h-24 w-full" />
			{[0, 1, 2].map((i) => (
				<div key={i} className="skeleton h-48 w-full" />
			))}
		</section>
	);
}
