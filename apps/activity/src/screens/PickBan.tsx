// [4] 픽/밴 + 결과
// 게임별로 1팀/2팀이 BLUE/RED 어느 쪽으로 시작할지 선택 + 5밴 + 5픽 + 결과.
// pickban draft 는 series 단위로 guild_kv 에 JSON 보관, Activity 재실행 시 복원.

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/rest.js";
import { wsClient } from "../api/ws.js";
import { LineupPreview, type LineupParticipant } from "../components/LineupPreview.js";
import { ConfirmButton } from "../components/ConfirmButton.js";
import { SaveStatusIndicator, type SaveStatus } from "../components/SaveStatus.js";
import { showToast } from "../components/Toaster.js";
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
		return wsClient.subscribe(`series:${seriesId}`, () => {
			setReloadKey((k) => k + 1);
			showToast("다른 운영자가 픽/밴/결과를 입력했습니다");
		});
	}, [seriesId]);

	// debounced save — 쓰기 권한 있는 경우에만
	const saveTimer = useRef<number | null>(null);
	const lastSavedDraft = useRef<string>("");
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
	const [savedAt, setSavedAt] = useState<number | null>(null);
	const [retryNonce, setRetryNonce] = useState(0);
	useEffect(() => {
		if (!draft || seriesId === null || !perms.canEdit) return;
		const serialized = JSON.stringify(draft);
		if (serialized === lastSavedDraft.current) return;
		setSaveStatus("saving");
		if (saveTimer.current) window.clearTimeout(saveTimer.current);
		saveTimer.current = window.setTimeout(() => {
			api(`/series/${seriesId}/pickban`, {
				method: "PUT",
				body: serialized,
			})
				.then(() => {
					lastSavedDraft.current = serialized;
					setSaveStatus("saved");
					setSavedAt(performance.now());
				})
				.catch((err) => {
					console.warn("[mookbot] pickban save failed", err);
					setSaveStatus("error");
				});
		}, 400);
		return () => {
			if (saveTimer.current) window.clearTimeout(saveTimer.current);
		};
	}, [draft, seriesId, perms.canEdit, retryNonce]);

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
					<h2 className="text-xl font-bold flex items-center gap-3">
						픽 / 밴
						{perms.canEdit && (
							<SaveStatusIndicator
								status={saveStatus}
								savedAt={savedAt}
								onRetry={() => setRetryNonce((n) => n + 1)}
							/>
						)}
					</h2>
					<p className="text-xs text-base-content/70">
						시리즈 #{detail.series.id} · {teamSize}v{teamSize} ·{" "}
						{detail.games.length}/3 게임 완료
						{seriesCompleted && (
							<span className="ml-2 badge badge-success badge-sm">시리즈 종료</span>
						)}
					</p>
				</div>
				<div className="flex items-center gap-1">
					<button
						type="button"
						className="btn btn-sm btn-ghost"
						onClick={() => setReloadKey((k) => k + 1)}
						title="새로고침"
						aria-label="새로고침"
					>
						↻
					</button>
					{perms.canEdit && (noGamesPlayed || !seriesCompleted) && (
						<div className="dropdown dropdown-end">
							<div
								tabIndex={0}
								role="button"
								className="btn btn-sm btn-ghost"
								aria-label="더 보기"
							>
								⋯
							</div>
							<div
								tabIndex={0}
								className="dropdown-content bg-base-100 rounded-box z-30 w-64 p-2 shadow-lg border border-base-300 space-y-1"
							>
								<div className="text-xs uppercase tracking-wide text-base-content/60 px-2 pt-1 pb-0.5">
									위험한 액션
								</div>
								{!noGamesPlayed && (
									<ConfirmButton
										label="↺ 직전 게임 되돌리기"
										onConfirm={undoLast}
										variant="error"
										className="w-full justify-start"
									/>
								)}
								{noGamesPlayed && (
									<ConfirmButton
										label="↩ 엔트리 수정 대기로"
										onConfirm={revert}
										variant="warning"
										className="w-full justify-start"
									/>
								)}
								<div className="text-[10px] text-base-content/50 px-2 pt-1 leading-snug">
									{!noGamesPlayed
										? "직전 게임 결과 + MMR 변동을 취소합니다."
										: "시리즈를 삭제하고 모집을 엔트리 수정 대기 상태로 되돌립니다."}
								</div>
							</div>
						</div>
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

			{/* 시리즈 스코어 + 라인업 — 단일 카드 (라인업 collapse) */}
			<div className={`card bg-base-200 shadow-sm ${seriesCompleted ? "border border-success" : ""}`}>
				<div className="card-body p-4 gap-3">
					<div className="flex items-end gap-4 flex-wrap">
						<div className="flex items-end gap-3 tabular-nums">
							<div className="text-center">
								<div className="text-[10px] uppercase tracking-wide text-info">1팀</div>
								<div className="text-3xl font-bold leading-none text-info">{t1Wins}</div>
							</div>
							<div className="text-2xl opacity-30 leading-none pb-1">:</div>
							<div className="text-center">
								<div className="text-[10px] uppercase tracking-wide text-error">2팀</div>
								<div className="text-3xl font-bold leading-none text-error">{t2Wins}</div>
							</div>
						</div>
						<div className="text-xs text-base-content/60 ml-1">
							Bo3 · {detail.games.length}/3 게임
							{!seriesCompleted && ` · Game ${draft.currentGame} 진행 중`}
						</div>
						{seriesCompleted && detail.series.winningTeam && (
							<div className="ml-auto flex items-center gap-2 px-3 py-1 rounded-md bg-success/10 border border-success/40">
								<span className="text-success text-base">🏆</span>
								<div>
									<div className="text-[10px] text-base-content/60 leading-none">우승</div>
									<div className="text-sm font-bold text-success">
										{detail.series.winningTeam === "TEAM_1" ? "1팀" : "2팀"}
									</div>
								</div>
							</div>
						)}
					</div>
					<details className="collapse collapse-arrow bg-base-100/40">
						<summary className="collapse-title text-sm font-medium py-2 min-h-0 px-3">
							라인업 보기
						</summary>
						<div className="collapse-content px-3">
							<LineupPreview participants={detail.participants} compact />
						</div>
					</details>
				</div>
			</div>

			<div role="tablist" className="tabs tabs-lift">
				{[1, 2, 3].map((n) => {
					const enabled = isGameTabEnabled(n);
					const recorded = completedGames.has(n);
					const game = detail.games.find((g) => g.gameNumber === n);
					const isCurrent = draft.currentGame === n;
					const tip = !enabled
						? `Game ${n - 1} 결과를 먼저 입력하세요`
						: recorded
							? `Game ${n} 결과 기록됨 — 다시 보기`
							: isCurrent
								? `Game ${n} 입력 중`
								: `Game ${n} 입력`;
					const tab = (
						<button
							role="tab"
							className={`tab ${isCurrent ? "tab-active" : ""} ${
								!enabled ? "opacity-40 cursor-not-allowed" : ""
							}`}
							onClick={() => setCurrentGame(n)}
							disabled={!enabled}
						>
							<span className="font-medium">Game {n}</span>
							{recorded && game && (
								<span
									className={`ml-1.5 badge badge-xs ${
										game.winningTeam === "TEAM_1" ? "badge-info" : "badge-error"
									}`}
								>
									{game.winningTeam === "TEAM_1" ? "1팀 W" : "2팀 W"}
								</span>
							)}
							{!recorded && isCurrent && enabled && (
								<span
									className="ml-1.5 inline-block size-1.5 rounded-full bg-success animate-pulse"
									aria-label="진행 중"
								/>
							)}
						</button>
					);
					return (
						<span key={n} className="tooltip tooltip-bottom" data-tip={tip}>
							{tab}
						</span>
					);
				})}
			</div>

			{team1Side && team2Side ? (
				<div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-base-200 text-sm">
					<div>
						<span className="text-xs text-base-content/60 mr-2">Game {draft.currentGame} 사이드</span>
						<span className={sideTextColor(team1Side)}>1팀 {team1Side}</span>
						<span className="opacity-30 mx-1.5">·</span>
						<span className={sideTextColor(team2Side)}>2팀 {team2Side}</span>
					</div>
					{!isCurrentGameRecorded && perms.canEdit && (
						<button
							type="button"
							className="btn btn-xs btn-ghost"
							onClick={() => setSide(team1Side === "BLUE" ? "RED" : "BLUE")}
						>
							사이드 변경
						</button>
					)}
				</div>
			) : (
				<div className="card bg-base-200 shadow-sm border-l-4 border-primary">
					<div className="card-body p-3 gap-2">
						<h3 className="font-bold text-sm">
							Game {draft.currentGame} — 1팀이 어느 사이드인가요?
						</h3>
						<div className="grid grid-cols-2 gap-2">
							<button
								type="button"
								onClick={() => setSide("BLUE")}
								className="btn h-auto flex-col py-3 btn-outline hover:btn-info"
								disabled={!perms.canEdit}
							>
								<span className="text-xs opacity-80">1팀</span>
								<span className="text-base font-bold">BLUE</span>
							</button>
							<button
								type="button"
								onClick={() => setSide("RED")}
								className="btn h-auto flex-col py-3 btn-outline hover:btn-error"
								disabled={!perms.canEdit}
							>
								<span className="text-xs opacity-80">1팀</span>
								<span className="text-base font-bold">RED</span>
							</button>
						</div>
					</div>
				</div>
			)}

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
					champions={champions}
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

function ChampCell({
	champ,
	disabled,
	blocked,
	reason,
	onClick,
}: {
	champ: Champion;
	disabled?: boolean;
	blocked?: "used" | "fearless";
	reason: string;
	onClick?: () => void;
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			title={reason}
			className={`relative rounded-md overflow-hidden transition flex flex-col items-center ${
				disabled
					? "opacity-40 grayscale cursor-not-allowed"
					: "hover:ring-2 hover:ring-primary hover:scale-105"
			}`}
		>
			<img
				src={champ.iconUrl}
				alt={champ.name}
				className="w-full aspect-square"
				draggable={false}
			/>
			<span className="text-[10px] truncate w-full px-1 bg-base-300 text-center">
				{champ.name}
			</span>
			{blocked === "fearless" && (
				<span
					className="absolute top-0.5 left-0.5 badge badge-error badge-xs"
					aria-label="Hard Fearless"
				>
					F
				</span>
			)}
			{blocked === "used" && (
				<span
					className="absolute top-0.5 left-0.5 badge badge-warning badge-xs"
					aria-label="이번 게임 사용"
				>
					U
				</span>
			)}
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
	const searchRef = useRef<HTMLInputElement | null>(null);

	// Esc — 검색 input focus + 검색어 있으면 검색 클리어 우선, 아니면 활성 슬롯 해제
	useEffect(() => {
		if (!activeSlot) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			if (document.activeElement === searchRef.current && search) {
				setSearch("");
				return;
			}
			setActiveSlot(null);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [activeSlot, search]);

	// 활성 슬롯 진입 시 검색 input 자동 focus — 챔프 검색 즉시 시작
	useEffect(() => {
		if (activeSlot && perms.canEdit) searchRef.current?.focus();
	}, [activeSlot, perms.canEdit]);

	// "/" 단축키로 검색 input focus — design_upgrade.md §4.5
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "/") return;
			const tag = (document.activeElement as HTMLElement | null)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return;
			e.preventDefault();
			searchRef.current?.focus();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

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

	// 사용 가능 / 사용 불가 분리 — design_upgrade.md §6.4.3
	const { usable, blocked } = useMemo(() => {
		const usable: Champion[] = [];
		const blocked: { champ: Champion; reason: "used" | "fearless" }[] = [];
		for (const c of filtered) {
			if (fearlessUsedIds.has(c.id)) blocked.push({ champ: c, reason: "fearless" });
			else if (usedIds.has(c.id)) blocked.push({ champ: c, reason: "used" });
			else usable.push(c);
		}
		return { usable, blocked };
	}, [filtered, usedIds, fearlessUsedIds]);

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

	const activeSlotInfo = (() => {
		if (!activeSlot) return null;
		const teamLabel = activeSlot.team === "TEAM_1" ? "1팀" : "2팀";
		const kindLabel = activeSlot.kind === "ban" ? "밴" : "픽";
		if (activeSlot.kind === "pick") {
			const lane = LANE_ORDER[activeSlot.idx];
			if (lane) {
				const player = lineup.get(`${activeSlot.team}_${lane}`);
				return `🎯 ${teamLabel} ${kindLabel} · ${LANE_LABEL[lane] ?? lane}${player ? ` (${player})` : ""}`;
			}
		}
		return `🎯 ${teamLabel} ${kindLabel} #${activeSlot.idx + 1}`;
	})();

	return (
		<div className="space-y-4">
			{/* 활성 슬롯 sticky 안내 — design_upgrade.md §6.4.2 #5 */}
			{activeSlotInfo && (
				<div className="alert alert-info alert-soft sticky top-2 z-20 shadow-md flex-row items-center">
					<span className="flex-1">
						{activeSlotInfo}
						<span className="text-xs opacity-70 ml-2">
							— 챔프 선택 또는 슬롯 다시 클릭 (Esc 취소)
						</span>
					</span>
					<button
						type="button"
						className="btn btn-xs btn-ghost"
						onClick={() => setActiveSlot(null)}
						aria-label="선택 취소"
					>
						✕
					</button>
				</div>
			)}

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
								ref={searchRef}
								type="text"
								placeholder="챔피언 검색… (한/영, / 키로 포커스)"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="input input-bordered join-item flex-1"
							/>
							<button
								type="button"
								className="btn btn-ghost join-item"
								onClick={() => setSearch("")}
								disabled={!search}
								title="검색 초기화 (Esc)"
								aria-label="검색 초기화"
							>
								✕
							</button>
						</div>
						<div className="text-xs text-base-content/60">
							{usable.length} 사용 가능
							{blocked.length > 0 && ` · ${blocked.length} 사용 불가`}
						</div>
					</div>

					{fearlessUsedIds.size > 0 && (
						<div className="text-xs text-base-content/60">
							🛡️ Hard Fearless — 이전 게임에서 사용된 {fearlessUsedIds.size}개 챔프 자동
							비활성화
						</div>
					)}

					{usable.length === 0 ? (
						<div className="text-center text-sm text-base-content/50 py-6">
							{search.trim()
								? `"${search}" 검색 결과 없음`
								: "사용 가능한 챔프가 없습니다."}
						</div>
					) : (
						<div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-1.5 max-h-[280px] overflow-y-auto pr-1">
							{usable.map((c) => (
								<ChampCell
									key={c.id}
									champ={c}
									disabled={!activeSlot}
									reason={!activeSlot ? "슬롯 먼저 선택" : c.name}
									onClick={() => {
										setSlot(c.id);
										setActiveSlot(null);
									}}
								/>
							))}
						</div>
					)}

					{blocked.length > 0 && (
						<details className="bg-base-100/40 rounded-md">
							<summary className="cursor-pointer text-xs font-medium px-3 py-2 text-base-content/70">
								사용 불가 ({blocked.length}) — 이번 게임 사용 또는 Hard Fearless
							</summary>
							<div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-1.5 max-h-[200px] overflow-y-auto p-3 pt-0">
								{blocked.map(({ champ, reason }) => (
									<ChampCell
										key={champ.id}
										champ={champ}
										disabled
										blocked={reason}
										reason={
											reason === "fearless"
												? `${champ.name} — 이전 게임에서 사용 (Hard Fearless)`
												: `${champ.name} — 이번 게임에서 이미 사용`
										}
									/>
								))}
							</div>
						</details>
					)}
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
	champions,
	onRecorded,
}: {
	seriesId: number;
	gameDraft: GameDraft;
	teamSize: number;
	participants: LineupParticipant[];
	champions: Champion[];
	onRecorded: () => void;
}) {
	const perms = usePerms();
	const [winner, setWinner] = useState<Team | null>(null);
	const [durationMin, setDurationMin] = useState<string>("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const lanes = LANE_ORDER.slice(0, teamSize);

	const champById = useMemo(() => {
		const m = new Map<number, Champion>();
		for (const c of champions) m.set(c.id, c);
		return m;
	}, [champions]);

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
				<div className="flex items-center justify-between flex-wrap gap-2">
					<h3 className="card-title text-base">Game {gameDraft.gameNumber} 결과 입력</h3>
					<span className="text-xs text-base-content/60">
						{[
							gameDraft.team1Side ? "사이드" : null,
							allBansFilled ? "밴" : null,
							allPicksFilled ? "픽" : null,
							winner ? "승자" : null,
						].filter(Boolean).length}
						/4 단계 완료
					</span>
				</div>

				{(!allBansFilled || !allPicksFilled) && (
					<div className="alert alert-warning alert-soft py-2">
						<span className="text-xs">
							{!allBansFilled && "⚠️ 밴 슬롯이 비어있습니다. "}
							{!allPicksFilled && "⚠️ 픽 슬롯이 비어있습니다."}
						</span>
					</div>
				)}

				<div className="grid grid-cols-2 gap-3">
					<ResultRadioCard
						team="TEAM_1"
						selected={winner === "TEAM_1"}
						onClick={() => setWinner("TEAM_1")}
						pickIds={gameDraft.picks.TEAM_1}
						lanes={lanes}
						champById={champById}
						disabled={!perms.canEdit}
					/>
					<ResultRadioCard
						team="TEAM_2"
						selected={winner === "TEAM_2"}
						onClick={() => setWinner("TEAM_2")}
						pickIds={gameDraft.picks.TEAM_2}
						lanes={lanes}
						champById={champById}
						disabled={!perms.canEdit}
					/>
				</div>

				<label className="form-control">
					<div className="label py-1">
						<span className="label-text text-xs text-base-content/70">
							게임 시간 (분, 선택)
						</span>
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
							className="btn btn-success btn-block sticky bottom-2"
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

function ResultRadioCard({
	team,
	selected,
	onClick,
	pickIds,
	lanes,
	champById,
	disabled,
}: {
	team: Team;
	selected: boolean;
	onClick: () => void;
	pickIds: (number | null)[];
	lanes: readonly string[];
	champById: Map<number, Champion>;
	disabled: boolean;
}) {
	const teamLabel = team === "TEAM_1" ? "1팀" : "2팀";
	// Tailwind JIT 가 동적 string 을 인식 못 하므로 미리 케이스별 정적 클래스.
	const styles =
		team === "TEAM_1"
			? {
					selectedBg: "bg-info/10 border-info",
					text: "text-info",
					radioFill: "bg-info border-info",
				}
			: {
					selectedBg: "bg-error/10 border-error",
					text: "text-error",
					radioFill: "bg-error border-error",
				};
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			role="radio"
			aria-checked={selected}
			className={`relative rounded-box border-2 p-3 text-left transition flex flex-col gap-2 ${
				disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
			} ${
				selected
					? styles.selectedBg
					: "bg-base-100 border-base-300 hover:border-base-content/30"
			}`}
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span
						className={`inline-flex items-center justify-center size-5 rounded-full border-2 ${
							selected ? styles.radioFill : "border-base-content/30"
						}`}
						aria-hidden
					>
						{selected && <span className="size-2 rounded-full bg-base-100" />}
					</span>
					<span className={`text-lg font-bold ${styles.text}`}>{teamLabel} 승</span>
				</div>
				{selected && <span className="badge badge-success badge-sm">선택됨</span>}
			</div>
			<div className="flex gap-1 mt-1">
				{pickIds.map((cid, i) => {
					const champ = cid !== null ? champById.get(cid) : null;
					return champ ? (
						<img
							key={i}
							src={champ.iconUrl}
							alt={champ.name}
							title={`${lanes[i]} · ${champ.name}`}
							className="size-7 rounded-md ring-1 ring-base-content/10"
							draggable={false}
						/>
					) : (
						<span
							key={i}
							className="size-7 rounded-md border border-dashed border-base-content/20"
							aria-hidden
						/>
					);
				})}
			</div>
		</button>
	);
}
