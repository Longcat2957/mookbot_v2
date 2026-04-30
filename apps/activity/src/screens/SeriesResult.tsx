// 지난 내전 결과 화면 (read-only) — 종료된 시리즈의 게임별 픽/밴 + 승자 + 라인업.

import { useEffect, useState } from "react";
import { api } from "../api/rest.js";
import { LineupPreview, type LineupParticipant } from "../components/LineupPreview.js";

type Team = "TEAM_1" | "TEAM_2";
type Side = "BLUE" | "RED";

interface Champion {
	id: number;
	idSlug: string;
	name: string;
	iconUrl: string;
}

interface SeriesDetail {
	series: {
		id: number;
		status: string;
		startedAt: number;
		winningTeam: Team | null;
	};
	participants: LineupParticipant[];
	games: {
		id: number;
		gameNumber: number;
		team1Side: Side;
		winningTeam: Team;
		durationSec: number | null;
		picks: { team: Team; role: string; championName: string; championId: number | null }[];
	}[];
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
}: {
	seriesId: number | null;
	onBack: () => void;
}) {
	const [detail, setDetail] = useState<SeriesDetail | null>(null);
	const [bansByGame, setBansByGame] = useState<Map<number, { team: Team; championName: string; championId: number | null }[]>>(new Map());
	const [error, setError] = useState<string | null>(null);
	const [champions, setChampions] = useState<Champion[]>([]);

	useEffect(() => {
		if (seriesId === null) return;
		let cancelled = false;
		setError(null);
		setDetail(null);

		Promise.all([
			api<SeriesDetail>(`/series/${seriesId}`),
			api<{ champions: Champion[] }>("/champions"),
		])
			.then(([d, c]) => {
				if (cancelled) return;
				setDetail(d);
				setChampions(c.champions);
				// bans 는 series detail 응답에 없음 — 게임별 별도 fetch (추후 API 통합)
				// 일단 picks 만 사용
				setBansByGame(new Map());
			})
			.catch((err: unknown) => {
				if (!cancelled) setError(err instanceof Error ? err.message : String(err));
			});

		return () => {
			cancelled = true;
		};
	}, [seriesId]);

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

	const champById = new Map<number, Champion>();
	for (const c of champions) champById.set(c.id, c);

	const t1Wins = detail.games.filter((g) => g.winningTeam === "TEAM_1").length;
	const t2Wins = detail.games.filter((g) => g.winningTeam === "TEAM_2").length;
	const teamSize = detail.participants.length / 2;

	return (
		<section className="space-y-4">
			<header className="flex items-center justify-between flex-wrap gap-2">
				<div>
					<h2 className="text-2xl font-bold">시리즈 #{detail.series.id} 결과</h2>
					<p className="text-sm text-base-content/70">
						{teamSize}v{teamSize} ·{" "}
						{detail.series.status === "COMPLETED" ? "종료" : detail.series.status}
					</p>
				</div>
				<button type="button" className="btn btn-sm btn-ghost" onClick={onBack}>
					← 대시보드
				</button>
			</header>

			<div className="card bg-base-200 shadow-sm">
				<div className="card-body p-4 flex-row items-center justify-between">
					<div className="flex items-center gap-6">
						<TeamScore label="1팀" wins={t1Wins} won={detail.series.winningTeam === "TEAM_1"} color="text-info" />
						<div className="text-2xl opacity-30">:</div>
						<TeamScore label="2팀" wins={t2Wins} won={detail.series.winningTeam === "TEAM_2"} color="text-warning" />
					</div>
					{detail.series.winningTeam && (
						<div className="text-right">
							<div className="text-xs text-base-content/60">우승</div>
							<div className="text-xl font-bold text-success">
								{detail.series.winningTeam === "TEAM_1" ? "1팀" : "2팀"}
							</div>
						</div>
					)}
				</div>
			</div>

			<div className="card bg-base-200 shadow-sm">
				<div className="card-body p-4">
					<h3 className="card-title text-sm mb-2">엔트리</h3>
					<LineupPreview participants={detail.participants} />
				</div>
			</div>

			{detail.games.length === 0 ? (
				<div className="alert">
					<span>기록된 게임이 없습니다.</span>
				</div>
			) : (
				<div className="space-y-3">
					{detail.games
						.slice()
						.sort((a, b) => a.gameNumber - b.gameNumber)
						.map((g) => (
							<GameSummaryCard
								key={g.id}
								game={g}
								participants={detail.participants}
								champById={champById}
							/>
						))}
				</div>
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
			<div className={`text-3xl font-bold tabular-nums ${won ? "text-success" : ""}`}>
				{wins}
			</div>
		</div>
	);
}

function GameSummaryCard({
	game,
	participants,
	champById,
}: {
	game: SeriesDetail["games"][number];
	participants: LineupParticipant[];
	champById: Map<number, Champion>;
}) {
	const team2Side: Side = game.team1Side === "BLUE" ? "RED" : "BLUE";
	const lineup = new Map<string, string>();
	for (const p of participants) lineup.set(`${p.team}_${p.role}`, p.displayName);

	const teamSize = participants.length / 2;
	const lanes = LANE_ORDER.slice(0, teamSize);

	const pickFor = (team: Team, role: string) =>
		game.picks.find((p) => p.team === team && p.role === role) ?? null;

	const duration = game.durationSec
		? `${Math.floor(game.durationSec / 60)}분 ${game.durationSec % 60}초`
		: null;

	return (
		<div className="card bg-base-200 shadow-sm">
			<div className="card-body p-4 gap-3">
				<div className="flex items-center justify-between flex-wrap gap-2">
					<h3 className="card-title text-base">Game {game.gameNumber}</h3>
					<div className="flex items-center gap-2 text-xs">
						<span className={`badge ${game.team1Side === "BLUE" ? "badge-info" : "badge-error"}`}>
							1팀 = {game.team1Side}
						</span>
						<span className={`badge ${team2Side === "BLUE" ? "badge-info" : "badge-error"}`}>
							2팀 = {team2Side}
						</span>
						{duration && <span className="opacity-70">⏱ {duration}</span>}
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					{(["TEAM_1", "TEAM_2"] as const).map((team) => {
						const isWinner = game.winningTeam === team;
						const teamLabel = team === "TEAM_1" ? "1팀" : "2팀";
						const side = team === "TEAM_1" ? game.team1Side : team2Side;
						return (
							<div
								key={team}
								className={`rounded-lg p-3 ${
									isWinner ? "bg-success/15 ring-2 ring-success/40" : "bg-base-300/40"
								}`}
							>
								<div className="flex items-center justify-between mb-2">
									<span className="font-bold">
										{teamLabel}
										{isWinner && (
											<span className="ml-2 badge badge-success badge-sm">승</span>
										)}
									</span>
									<span
										className={`badge badge-sm ${
											side === "BLUE" ? "badge-info" : "badge-error"
										}`}
									>
										{side}
									</span>
								</div>
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
													<div className="text-xs text-base-content/60">
														{LANE_LABEL[lane]}
													</div>
													<div className="text-sm font-medium truncate">
														{player}
													</div>
													{pick && (
														<div className="text-xs text-base-content/70 truncate">
															{pick.championName}
														</div>
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
		</div>
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
