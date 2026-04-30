// [4] 픽/밴 + 결과
// 게임별로 1팀/2팀이 BLUE/RED 어느 쪽으로 시작할지 선택 + 5밴 + 5픽 + 결과.
// pickban draft 는 series 단위로 guild_kv 에 JSON 보관, Activity 재실행 시 복원.

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/rest.js";
import { wsClient } from "../api/ws.js";
import { LineupPreview, type LineupParticipant } from "../components/LineupPreview.js";
import { ConfirmButton } from "../components/ConfirmButton.js";
import { usePerms } from "../state/perms.js";

const LANE_LABEL: Record<string, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};

const LANE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;

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
	pickbanDraft: PickBanDraft | null;
}

interface GameDraft {
	gameNumber: number;
	team1Side: Side | null;
	bans: { TEAM_1: (number | null)[]; TEAM_2: (number | null)[] };
	picks: { TEAM_1: (number | null)[]; TEAM_2: (number | null)[] };
}

interface PickBanDraft {
	games: GameDraft[];
	currentGame: number;
}

function emptyGameDraft(n: number, banCount: number, pickCount: number): GameDraft {
	return {
		gameNumber: n,
		team1Side: null,
		bans: {
			TEAM_1: Array(banCount).fill(null),
			TEAM_2: Array(banCount).fill(null),
		},
		picks: {
			TEAM_1: Array(pickCount).fill(null),
			TEAM_2: Array(pickCount).fill(null),
		},
	};
}

// ============================================================
// 메인
// ============================================================

export function PickBan({
	seriesId,
	onBack,
}: {
	seriesId: number | null;
	onBack: () => void;
}) {
	const [detail, setDetail] = useState<SeriesDetail | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [reloadKey, setReloadKey] = useState(0);
	const [draft, setDraft] = useState<PickBanDraft | null>(null);
	const [champions, setChampions] = useState<Champion[]>([]);
	// 2-click confirm 은 ConfirmButton 컴포넌트가 내부 state 로 처리.
	// (Discord Activity iframe sandbox 가 native confirm 차단)
	const [actionError, setActionError] = useState<string | null>(null);
	const perms = usePerms();

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

				const teamSize = d.participants.length / 2;
				const initialDraft: PickBanDraft = d.pickbanDraft ?? {
					games: [1, 2, 3].map((n) => emptyGameDraft(n, teamSize, teamSize)),
					currentGame: 1,
				};
				setDraft(initialDraft);
			})
			.catch((err: unknown) => {
				if (!cancelled) setError(err instanceof Error ? err.message : String(err));
			});

		return () => {
			cancelled = true;
		};
	}, [seriesId, reloadKey]);

	// series topic 구독 — 다른 사용자가 픽/밴 / 게임 결과 등으로 변경 시 자동 reload
	useEffect(() => {
		if (seriesId === null) return;
		return wsClient.subscribe(`series:${seriesId}`, () =>
			setReloadKey((k) => k + 1),
		);
	}, [seriesId]);

	// debounced save — 쓰기 권한 있는 경우에만
	const saveTimer = useRef<number | null>(null);
	useEffect(() => {
		if (!draft || seriesId === null || !perms.canEdit) return;
		if (saveTimer.current) window.clearTimeout(saveTimer.current);
		saveTimer.current = window.setTimeout(() => {
			api(`/series/${seriesId}/pickban`, {
				method: "PUT",
				body: JSON.stringify(draft),
			}).catch((err) => {
				console.warn("[mookbot] pickban save failed", err);
			});
		}, 400);
		return () => {
			if (saveTimer.current) window.clearTimeout(saveTimer.current);
		};
	}, [draft, seriesId, perms.canEdit]);

	if (seriesId === null) {
		return (
			<div className="alert alert-warning">
				<span>시리즈를 먼저 선택해주세요.</span>
			</div>
		);
	}
	if (error) {
		return (
			<div className="space-y-3">
				<div className="alert alert-error">
					<span>시리즈 정보를 불러오지 못했습니다: {error}</span>
				</div>
				<button
					type="button"
					className="btn btn-sm btn-outline"
					onClick={() => setReloadKey((k) => k + 1)}
				>
					↻ 새로고침
				</button>
			</div>
		);
	}
	if (!detail || !draft) return <PickBanSkeleton />;

	const teamSize = detail.participants.length / 2;
	const completedGames = new Set(detail.games.map((g) => g.gameNumber));
	const noGamesPlayed = detail.games.length === 0;
	const currentGameDraft = draft.games[draft.currentGame - 1]!;
	const isCurrentGameRecorded = completedGames.has(draft.currentGame);
	const seriesCompleted = detail.series.status === "COMPLETED";

	// Bo3 스코어
	const t1Wins = detail.games.filter((g) => g.winningTeam === "TEAM_1").length;
	const t2Wins = detail.games.filter((g) => g.winningTeam === "TEAM_2").length;

	const team1Side: Side | null = currentGameDraft.team1Side;
	const team2Side: Side | null =
		team1Side === "BLUE" ? "RED" : team1Side === "RED" ? "BLUE" : null;

	// Game N 입력은 Game N-1 이 완료된 후에만 허용
	const isGameTabEnabled = (n: number): boolean => {
		if (n === 1) return true;
		return completedGames.has(n - 1);
	};

	const setCurrentGame = (n: number) => {
		if (!isGameTabEnabled(n)) return;
		setDraft((prev) => (prev ? { ...prev, currentGame: n } : prev));
	};

	// Hard Fearless: 시리즈 내 같은 챔프 픽 금지 (양 팀 합산).
	// 현재 게임 이전의 모든 픽 → 현재 게임 그리드에서 비활성화.
	const fearlessUsedIds = (() => {
		const set = new Set<number>();
		for (const g of detail.games) {
			if (g.gameNumber >= draft.currentGame) continue;
			for (const p of g.picks) if (p.championId !== null) set.add(p.championId);
		}
		// 미기록이지만 draft 에 작성된 이전 게임의 픽도 포함
		for (const g of draft.games) {
			if (g.gameNumber >= draft.currentGame) continue;
			for (const team of ["TEAM_1", "TEAM_2"] as const) {
				for (const c of g.picks[team]) if (c !== null) set.add(c);
			}
		}
		return set;
	})();

	const setSide = (side: Side) =>
		setDraft((prev) => {
			if (!prev) return prev;
			const games = prev.games.map((g, i) =>
				i === prev.currentGame - 1 ? { ...g, team1Side: side } : g,
			);
			return { ...prev, games };
		});

	const revert = async () => {
		setActionError(null);
		try {
			await api(`/series/${seriesId}/revert`, { method: "POST" });
			onBack();
		} catch (err) {
			setActionError(`되돌리기 실패: ${err instanceof Error ? err.message : String(err)}`);
		}
	};

	const undoLast = async () => {
		setActionError(null);
		try {
			await api(`/series/${seriesId}/games/last`, { method: "DELETE" });
			setReloadKey((k) => k + 1);
		} catch (err) {
			setActionError(`되돌리기 실패: ${err instanceof Error ? err.message : String(err)}`);
		}
	};

	return (
		<section className="space-y-3">
			<header className="flex items-center justify-between flex-wrap gap-2">
				<div>
					<h2 className="text-xl font-bold">픽 / 밴</h2>
					<p className="text-xs text-base-content/70">
						시리즈 #{detail.series.id} · {teamSize}v{teamSize} ·{" "}
						{detail.games.length}/3 게임 완료
						{seriesCompleted && (
							<span className="ml-2 badge badge-success badge-sm">시리즈 종료</span>
						)}
					</p>
				</div>
				<div className="join">
					<button
						className="btn btn-sm btn-ghost join-item"
						onClick={() => setReloadKey((k) => k + 1)}
						title="새로고침"
					>
						↻
					</button>
					{!noGamesPlayed && perms.canEdit && (
						<ConfirmButton
							label="↺ 직전 게임 되돌리기"
							onConfirm={undoLast}
							className="join-item"
							variant="error"
							title="직전 게임 결과 + MMR 변동 취소"
						/>
					)}
					{noGamesPlayed && perms.canEdit && (
						<ConfirmButton
							label="엔트리 수정 대기로"
							onConfirm={revert}
							className="join-item"
							variant="warning"
							title="시리즈 삭제 후 모집을 엔트리 수정 대기 상태로 되돌립니다."
						/>
					)}
				</div>
			</header>

			{actionError && (
				<div className="alert alert-error">
					<span>{actionError}</span>
				</div>
			)}

			{!perms.canEdit && (
				<div className="alert alert-warning">
					<span>👁 읽기 전용 — 운영자 role 이 필요합니다. 픽/밴 / 결과 입력 불가.</span>
				</div>
			)}

			{/* 시리즈 스코어 + 라인업 — 한 행에 통합 */}
			<div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-3">
				<div className="card bg-base-200 shadow-sm">
					<div className="card-body p-3 flex-row items-center gap-4">
						<div className="text-center">
							<div className="text-[10px] text-info uppercase">1팀</div>
							<div className="text-2xl font-bold tabular-nums">{t1Wins}</div>
						</div>
						<div className="text-xl opacity-30">:</div>
						<div className="text-center">
							<div className="text-[10px] text-error uppercase">2팀</div>
							<div className="text-2xl font-bold tabular-nums">{t2Wins}</div>
						</div>
						{seriesCompleted && detail.series.winningTeam && (
							<div className="text-right border-l border-base-300 pl-3 ml-1">
								<div className="text-[10px] text-base-content/60">우승</div>
								<div className="text-sm font-bold text-success">
									{detail.series.winningTeam === "TEAM_1" ? "1팀" : "2팀"}
								</div>
							</div>
						)}
					</div>
				</div>
				<div className="card bg-base-200 shadow-sm">
					<div className="card-body p-3">
						<LineupPreview participants={detail.participants} compact />
					</div>
				</div>
			</div>

			<div role="tablist" className="tabs tabs-boxed bg-base-200 w-fit">
				{[1, 2, 3].map((n) => {
					const enabled = isGameTabEnabled(n);
					const recorded = completedGames.has(n);
					const tip = !enabled
						? `Game ${n - 1} 결과를 먼저 입력하세요`
						: recorded
							? `Game ${n} 결과 기록됨 — 다시 보기`
							: `Game ${n} 입력`;
					const tab = (
						<button
							role="tab"
							className={`tab ${draft.currentGame === n ? "tab-active" : ""} ${
								!enabled ? "opacity-40 cursor-not-allowed" : ""
							}`}
							onClick={() => setCurrentGame(n)}
							disabled={!enabled}
						>
							Game {n}
							{recorded && <span className="ml-1 text-success">✓</span>}
						</button>
					);
					return (
						<span key={n} className="tooltip tooltip-bottom" data-tip={tip}>
							{tab}
						</span>
					);
				})}
			</div>

			<div className="card bg-base-200 shadow-sm">
				<div className="card-body p-3 gap-2">
					<div className="flex items-center justify-between flex-wrap gap-2">
						<h3 className="font-bold text-sm">Game {draft.currentGame} 사이드</h3>
						{team1Side && team2Side && (
							<div className="text-xs text-base-content/80">
								<span className={sideTextColor(team1Side)}>1팀={team1Side}</span> ·{" "}
								<span className={sideTextColor(team2Side)}>2팀={team2Side}</span>
							</div>
						)}
					</div>
					<div className="grid grid-cols-2 gap-2">
						<SideButton
							team="TEAM_1"
							side="BLUE"
							selected={team1Side === "BLUE"}
							onClick={() => setSide("BLUE")}
						/>
						<SideButton
							team="TEAM_1"
							side="RED"
							selected={team1Side === "RED"}
							onClick={() => setSide("RED")}
						/>
					</div>
				</div>
			</div>

			{team1Side && (
				<PickBanBoard
					teamSize={teamSize}
					gameDraft={currentGameDraft}
					team1Side={team1Side}
					participants={detail.participants}
					champions={champions}
					fearlessUsedIds={fearlessUsedIds}
					onChange={(g) =>
						setDraft((prev) => {
							if (!prev) return prev;
							const games = prev.games.map((x, i) =>
								i === prev.currentGame - 1 ? g : x,
							);
							return { ...prev, games };
						})
					}
				/>
			)}

			{/* 결과 입력 — 슬롯 다 채워졌고 사이드 결정 + 미기록 게임일 때만 노출 */}
			{team1Side && !isCurrentGameRecorded && !seriesCompleted && (
				<ResultPanel
					seriesId={seriesId!}
					gameDraft={currentGameDraft}
					teamSize={teamSize}
					participants={detail.participants}
					onRecorded={() => setReloadKey((k) => k + 1)}
				/>
			)}

			{/* 게임 N 이미 기록됨 안내 */}
			{isCurrentGameRecorded && (
				<div className="alert alert-success">
					<span>Game {draft.currentGame} 결과가 이미 기록되었습니다.</span>
				</div>
			)}
		</section>
	);
}

function SideButton({
	team,
	side,
	selected,
	onClick,
}: {
	team: Team;
	side: Side;
	selected: boolean;
	onClick: () => void;
}) {
	const teamLabel = team === "TEAM_1" ? "1팀" : "2팀";
	return (
		<button
			type="button"
			onClick={onClick}
			className={`btn btn-sm h-auto py-2 ${
				selected ? (side === "BLUE" ? "btn-info" : "btn-error") : "btn-outline"
			}`}
		>
			<span className="text-xs opacity-80">{teamLabel}</span>
			<span className="text-base font-bold">{side}</span>
		</button>
	);
}

function sideTextColor(side: Side): string {
	return side === "BLUE" ? "text-info font-bold" : "text-error font-bold";
}

// ============================================================
// 픽/밴 보드
// ============================================================

function PickBanBoard({
	teamSize,
	gameDraft,
	team1Side,
	participants,
	champions,
	fearlessUsedIds,
	onChange,
}: {
	teamSize: number;
	gameDraft: GameDraft;
	team1Side: Side;
	participants: LineupParticipant[];
	champions: Champion[];
	fearlessUsedIds: Set<number>;
	onChange: (g: GameDraft) => void;
}) {
	const perms = usePerms();
	const [search, setSearch] = useState("");
	const [activeSlot, setActiveSlot] = useState<{
		kind: "ban" | "pick";
		team: Team;
		idx: number;
	} | null>(null);

	const usedIds = useMemo(() => {
		const set = new Set<number>();
		for (const arr of [
			gameDraft.bans.TEAM_1,
			gameDraft.bans.TEAM_2,
			gameDraft.picks.TEAM_1,
			gameDraft.picks.TEAM_2,
		]) {
			for (const c of arr) if (c !== null) set.add(c);
		}
		return set;
	}, [gameDraft]);

	const filtered = useMemo(() => {
		if (!search.trim()) return champions;
		const q = search.trim().toLowerCase();
		return champions.filter(
			(c) =>
				c.name.toLowerCase().includes(q) ||
				c.idSlug.toLowerCase().includes(q) ||
				c.name.replace(/\s+/g, "").toLowerCase().includes(q),
		);
	}, [champions, search]);

	const lineup = useMemo(() => {
		const map = new Map<string, string>();
		for (const p of participants) map.set(`${p.team}_${p.role}`, p.displayName);
		return map;
	}, [participants]);

	const setSlot = (championId: number | null) => {
		if (!activeSlot) return;
		const next: GameDraft = {
			...gameDraft,
			bans: {
				TEAM_1: [...gameDraft.bans.TEAM_1],
				TEAM_2: [...gameDraft.bans.TEAM_2],
			},
			picks: {
				TEAM_1: [...gameDraft.picks.TEAM_1],
				TEAM_2: [...gameDraft.picks.TEAM_2],
			},
		};
		const arr =
			activeSlot.kind === "ban" ? next.bans[activeSlot.team] : next.picks[activeSlot.team];
		arr[activeSlot.idx] = championId;
		onChange(next);
	};

	const team2Side: Side = team1Side === "BLUE" ? "RED" : "BLUE";

	// 슬롯 클릭: 같은 슬롯이 이미 active 이고 챔프가 차있으면 → 삭제. 아니면 → activate.
	const handleSlotClick = (team: Team, kind: "ban" | "pick", idx: number) => {
		if (!perms.canEdit) return;
		const arr = kind === "ban" ? gameDraft.bans[team] : gameDraft.picks[team];
		const filled = arr[idx] !== null;
		const same =
			activeSlot?.kind === kind &&
			activeSlot?.team === team &&
			activeSlot?.idx === idx;
		if (same && filled) {
			setActiveSlot({ kind, team, idx });
			queueMicrotask(() => {
				setSlot(null);
				setActiveSlot(null);
			});
			return;
		}
		setActiveSlot({ kind, team, idx });
	};

	return (
		<div className="space-y-4">
			{/* 픽/밴 보드 — 1팀 | 2팀 */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<TeamColumn
					team="TEAM_1"
					side={team1Side}
					teamSize={teamSize}
					draft={gameDraft}
					lineup={lineup}
					champions={champions}
					activeSlot={activeSlot}
					onSlotClick={handleSlotClick}
				/>
				<TeamColumn
					team="TEAM_2"
					side={team2Side}
					teamSize={teamSize}
					draft={gameDraft}
					lineup={lineup}
					champions={champions}
					activeSlot={activeSlot}
					onSlotClick={handleSlotClick}
				/>
			</div>

			{/* 챔프 그리드 (전체 너비) */}
			<div className="card bg-base-200 shadow-sm">
				<div className="card-body p-4 gap-3">
					<div className="flex items-center gap-2 flex-wrap">
						<div className="join flex-1 min-w-[200px]">
							<input
								type="text"
								placeholder="챔피언 검색… (한/영 모두)"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="input input-bordered join-item flex-1"
							/>
							<button
								type="button"
								className="btn btn-ghost join-item"
								onClick={() => setSearch("")}
								disabled={!search}
								title="검색 초기화"
							>
								✕
							</button>
						</div>
						<div className="text-sm">
							{activeSlot ? (
								<span className="badge badge-primary">
									{activeSlot.kind === "ban" ? "밴" : "픽"} 슬롯 #
									{activeSlot.idx + 1} ·{" "}
									{activeSlot.team === "TEAM_1" ? "1팀" : "2팀"}
								</span>
							) : (
								<span className="text-base-content/50">슬롯 클릭 후 챔프 선택</span>
							)}
						</div>
					</div>

					{fearlessUsedIds.size > 0 && (
						<div className="text-xs text-base-content/60">
							🛡️ Hard Fearless — 이전 게임에서 사용된 {fearlessUsedIds.size}개 챔프 자동
							비활성화
						</div>
					)}

					<div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-1.5 max-h-[280px] overflow-y-auto pr-1">
						{filtered.map((c) => {
							const used = usedIds.has(c.id);
							const fearless = fearlessUsedIds.has(c.id);
							const disabled = !activeSlot || used || fearless;
							const reason = fearless
								? `${c.name} — 이전 게임에서 사용 (Hard Fearless)`
								: used
									? `${c.name} — 이번 게임에서 이미 사용`
									: c.name;
							return (
								<button
									key={c.id}
									type="button"
									disabled={disabled}
									onClick={() => {
										setSlot(c.id);
										setActiveSlot(null);
									}}
									title={reason}
									className={`relative rounded-md overflow-hidden transition flex flex-col items-center ${
										disabled
											? "opacity-30 grayscale cursor-not-allowed"
											: "hover:ring-2 hover:ring-primary hover:scale-105"
									}`}
								>
									<img
										src={c.iconUrl}
										alt={c.name}
										className="w-full aspect-square"
										draggable={false}
									/>
									<span className="text-[10px] truncate w-full px-1 bg-base-300 text-center">
										{c.name}
									</span>
									{fearless && (
										<span className="absolute top-0.5 left-0.5 badge badge-error badge-xs">
											F
										</span>
									)}
								</button>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}

function TeamColumn({
	team,
	side,
	teamSize,
	draft,
	lineup,
	champions,
	activeSlot,
	onSlotClick,
}: {
	team: Team;
	side: Side;
	teamSize: number;
	draft: GameDraft;
	lineup: Map<string, string>;
	champions: Champion[];
	activeSlot: { kind: "ban" | "pick"; team: Team; idx: number } | null;
	onSlotClick: (team: Team, kind: "ban" | "pick", idx: number) => void;
}) {
	const teamLabel = team === "TEAM_1" ? "1팀" : "2팀";
	const champById = useMemo(() => {
		const m = new Map<number, Champion>();
		for (const c of champions) m.set(c.id, c);
		return m;
	}, [champions]);

	const headerColor = side === "BLUE" ? "text-info" : "text-error";
	const borderColor = side === "BLUE" ? "border-info" : "border-error";
	const lanes = LANE_ORDER.slice(0, teamSize);

	return (
		<div className={`card bg-base-200 shadow-sm border-l-4 ${borderColor}`}>
			<div className="card-body p-3 gap-2">
				<div className="flex items-center justify-between">
					<h3 className={`card-title text-base ${headerColor}`}>{teamLabel}</h3>
					<span className={`badge ${side === "BLUE" ? "badge-info" : "badge-error"}`}>
						{side}
					</span>
				</div>

				<div>
					<div className="text-xs text-base-content/60 mb-1 uppercase tracking-wide">
						밴 ({draft.bans[team].filter(Boolean).length}/{teamSize})
					</div>
					<div className="flex gap-1 flex-wrap">
						{draft.bans[team].map((cid, i) => (
							<SlotTile
								key={`b${i}`}
								size="md"
								champion={cid !== null ? champById.get(cid) ?? null : null}
								active={
									activeSlot?.kind === "ban" &&
									activeSlot.team === team &&
									activeSlot.idx === i
								}
								onClick={() => onSlotClick(team, "ban", i)}
								banned
							/>
						))}
					</div>
				</div>

				<div>
					<div className="text-xs text-base-content/60 mb-1 uppercase tracking-wide">
						픽 ({draft.picks[team].filter(Boolean).length}/{teamSize})
					</div>
					<div className="space-y-1">
						{lanes.map((lane, i) => {
							const cid = draft.picks[team][i] ?? null;
							const player = lineup.get(`${team}_${lane}`) ?? "—";
							return (
								<div
									key={lane}
									className="flex items-center gap-2 bg-base-300/40 rounded-md p-1.5"
								>
									<SlotTile
										size="lg"
										champion={cid !== null ? champById.get(cid) ?? null : null}
										active={
											activeSlot?.kind === "pick" &&
											activeSlot.team === team &&
											activeSlot.idx === i
										}
										onClick={() => onSlotClick(team, "pick", i)}
									/>
									<div className="flex-1 min-w-0 leading-tight">
										<div className="text-[10px] text-base-content/60">
											{LANE_LABEL[lane]}
										</div>
										<div className="text-sm font-semibold truncate">
											{player}
										</div>
										{cid !== null && (
											<div className="text-xs text-base-content/70 truncate">
												{champById.get(cid)?.name ?? ""}
											</div>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}

function SlotTile({
	champion,
	active,
	banned = false,
	size = "md",
	onClick,
}: {
	champion: Champion | null;
	active: boolean;
	banned?: boolean;
	size?: "md" | "lg";
	onClick: () => void;
}) {
	const dim = size === "lg" ? "w-12 h-12" : "w-10 h-10";
	return (
		<button
			type="button"
			onClick={onClick}
			title={champion?.name ?? (active ? "다시 클릭하여 해제" : "슬롯 선택")}
			className={`${dim} relative shrink-0 rounded-lg border-2 overflow-hidden transition flex items-center justify-center ${
				active
					? "border-primary ring-2 ring-primary/40"
					: champion
						? "border-base-content/30 hover:border-primary/60"
						: "border-dashed border-base-content/20 hover:border-primary/60"
			} ${banned && champion ? "grayscale opacity-70" : ""}`}
		>
			{champion ? (
				<img
					src={champion.iconUrl}
					alt={champion.name}
					className="w-full h-full"
					draggable={false}
				/>
			) : (
				<span className="text-2xl text-base-content/30">+</span>
			)}
			{active && champion && (
				<span className="absolute inset-0 flex items-center justify-center bg-error/40 text-white text-[10px] font-bold opacity-0 hover:opacity-100 transition">
					한번 더 = 삭제
				</span>
			)}
		</button>
	);
}

function PickBanSkeleton() {
	return (
		<section className="space-y-4">
			<div className="flex items-center justify-between">
				<div className="space-y-2">
					<div className="skeleton h-7 w-32" />
					<div className="skeleton h-4 w-48" />
				</div>
				<div className="skeleton h-8 w-32" />
			</div>
			<div className="skeleton h-32 w-full" />
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
				<div className="skeleton h-96 w-full" />
				<div className="skeleton h-96 w-full" />
				<div className="skeleton h-96 w-full" />
			</div>
		</section>
	);
}

// ============================================================
// 결과 입력 패널 — 승팀 + duration + 기록
// ============================================================

function ResultPanel({
	seriesId,
	gameDraft,
	teamSize,
	participants,
	onRecorded,
}: {
	seriesId: number;
	gameDraft: GameDraft;
	teamSize: number;
	participants: LineupParticipant[];
	onRecorded: () => void;
}) {
	const perms = usePerms();
	const [winner, setWinner] = useState<Team | null>(null);
	const [durationMin, setDurationMin] = useState<string>("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const lanes = LANE_ORDER.slice(0, teamSize);

	// 모든 슬롯 채워졌는지 검증
	const allBansFilled =
		gameDraft.bans.TEAM_1.every((c) => c !== null) &&
		gameDraft.bans.TEAM_2.every((c) => c !== null);
	const allPicksFilled =
		gameDraft.picks.TEAM_1.every((c) => c !== null) &&
		gameDraft.picks.TEAM_2.every((c) => c !== null);
	const ready = allBansFilled && allPicksFilled && winner !== null && gameDraft.team1Side !== null;

	const submit = async () => {
		if (!ready || gameDraft.team1Side === null || winner === null) return;
		setSubmitting(true);
		setError(null);
		try {
			const partByTeamRole = new Map<string, LineupParticipant>();
			for (const p of participants) partByTeamRole.set(`${p.team}_${p.role}`, p);

			const buildPicks = (team: Team) =>
				lanes.map((lane, i) => ({
					role: lane,
					championId: gameDraft.picks[team][i] ?? -1,
				}));

			await api(`/series/${seriesId}/games`, {
				method: "POST",
				body: JSON.stringify({
					gameNumber: gameDraft.gameNumber,
					team1Side: gameDraft.team1Side,
					winningTeam: winner,
					durationMin: durationMin ? Number(durationMin) : undefined,
					picks: {
						TEAM_1: buildPicks("TEAM_1"),
						TEAM_2: buildPicks("TEAM_2"),
					},
					bans: {
						TEAM_1: gameDraft.bans.TEAM_1.filter((c): c is number => c !== null),
						TEAM_2: gameDraft.bans.TEAM_2.filter((c): c is number => c !== null),
					},
				}),
			});
			onRecorded();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setSubmitting(false);
		}
	};

	return (
		<div className="card bg-base-200 shadow-sm border-l-4 border-success">
			<div className="card-body p-4 gap-3">
				<h3 className="card-title text-base">Game {gameDraft.gameNumber} — 결과 입력</h3>

				{!allBansFilled && (
					<div className="text-xs text-warning">⚠️ 밴 슬롯이 비어있습니다.</div>
				)}
				{!allPicksFilled && (
					<div className="text-xs text-warning">⚠️ 픽 슬롯이 비어있습니다.</div>
				)}

				<div className="grid grid-cols-2 gap-3">
					<button
						type="button"
						onClick={() => setWinner("TEAM_1")}
						className={`btn h-auto flex-col py-4 ${
							winner === "TEAM_1" ? "btn-info" : "btn-outline"
						}`}
					>
						<span className="text-sm opacity-80">승리</span>
						<span className="text-2xl font-bold">1팀</span>
					</button>
					<button
						type="button"
						onClick={() => setWinner("TEAM_2")}
						className={`btn h-auto flex-col py-4 ${
							winner === "TEAM_2" ? "btn-error" : "btn-outline"
						}`}
					>
						<span className="text-sm opacity-80">승리</span>
						<span className="text-2xl font-bold">2팀</span>
					</button>
				</div>

				<label className="form-control">
					<div className="label">
						<span className="label-text text-xs">게임 시간 (분, 선택)</span>
					</div>
					<input
						type="number"
						min="0"
						placeholder="예: 32"
						value={durationMin}
						onChange={(e) => setDurationMin(e.target.value)}
						className="input input-bordered input-sm"
					/>
				</label>

				{error && (
					<div className="alert alert-error">
						<span>{error}</span>
					</div>
				)}

				{(() => {
					const tip = !perms.canEdit
						? "쓰기 권한이 없습니다 (읽기 전용)"
						: !allBansFilled
							? "밴 슬롯을 모두 채워야 합니다."
							: !allPicksFilled
								? "픽 슬롯을 모두 채워야 합니다."
								: gameDraft.team1Side === null
									? "사이드(BLUE/RED)를 먼저 선택하세요."
									: winner === null
										? "승리 팀을 선택하세요."
										: undefined;
					const btn = (
						<button
							type="button"
							className="btn btn-success w-full"
							onClick={submit}
							disabled={!ready || submitting || !perms.canEdit}
						>
							{submitting ? (
								<>
									<span className="loading loading-spinner loading-sm" />
									기록 중…
								</>
							) : (
								`Game ${gameDraft.gameNumber} 결과 기록`
							)}
						</button>
					);
					return tip ? (
						<span className="tooltip tooltip-top w-full block" data-tip={tip}>
							{btn}
						</span>
					) : (
						btn
					);
				})()}
			</div>
		</div>
	);
}
