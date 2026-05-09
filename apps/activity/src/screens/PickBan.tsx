// [4] 픽/밴 + 결과
// 게임별로 1팀/2팀이 BLUE/RED 어느 쪽으로 시작할지 선택 + 5밴 + 5픽 + 결과.
// pickban draft 는 series 단위로 guild_kv 에 JSON 보관, Activity 재실행 시 복원.
//
// 서브 컴포넌트 / types / 헬퍼는 ./PickBan/ 디렉토리로 분리. 이 파일은 orchestration 만.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/rest.js";
import { wsClient } from "../api/ws.js";
import { BalancePreview } from "../components/BalancePreview.js";
import { ConfirmButton } from "../components/ConfirmButton.js";
import { LineupPreview } from "../components/LineupPreview.js";
import { type SaveStatus, SaveStatusIndicator } from "../components/SaveStatus.js";
import { showToast } from "../components/Toaster.js";
import { usePerms } from "../state/perms.js";
import { useStaleWhileRevalidate } from "../state/useStaleWhileRevalidate.js";
import { PickBanBoard } from "./PickBan/PickBanBoard.js";
import { PickBanSkeleton } from "./PickBan/PickBanSkeleton.js";
import { ResultPanel } from "./PickBan/ResultPanel.js";
import {
	type Champion,
	emptyGameDraft,
	type PickBanDraft,
	type SeriesDetail,
	type Side,
	sideTextColor,
} from "./PickBan/types.js";

export function PickBan({
	seriesId,
	onBack,
	onSelectUser,
}: {
	seriesId: number | null;
	onBack: () => void;
	onSelectUser?: (userId: string) => void;
}) {
	const [draft, setDraft] = useState<PickBanDraft | null>(null);
	// 2-click confirm 은 ConfirmButton 컴포넌트가 내부 state 로 처리.
	// (Discord Activity iframe sandbox 가 native confirm 차단)
	const [actionError, setActionError] = useState<string | null>(null);
	// 관전 모드 alert dismissible (세션 단위) — design_upgrade.md §6.7
	const readOnlyDismissKey = seriesId !== null ? `readonly-dismissed-series-${seriesId}` : "";
	const [readOnlyDismissed, setReadOnlyDismissed] = useState(false);
	useEffect(() => {
		if (!readOnlyDismissKey) return;
		setReadOnlyDismissed(sessionStorage.getItem(readOnlyDismissKey) === "1");
	}, [readOnlyDismissKey]);
	const perms = usePerms();

	// debounced save — 쓰기 권한 있는 경우에만 (SWR 의 dirty 보호 비교에 사용)
	const saveTimer = useRef<number | null>(null);
	const lastSavedDraft = useRef<string>("");

	// SWR — series detail. dirty 보호 onApply 안 (hot_fix.md §3.4).
	const detailFetcher = useCallback(() => api<SeriesDetail>(`/series/${seriesId}`), [seriesId]);
	const detailSwr = useStaleWhileRevalidate<SeriesDetail>(seriesId, detailFetcher, {
		debounceMs: 150,
		enabled: seriesId !== null,
		onApply: (next, prev) => {
			if (prev === null) {
				// 첫 로드 — server draft 또는 fresh draft (Bo3 3 게임 빈 슬롯)
				const teamSize = next.participants.length / 2;
				const initialDraft: PickBanDraft = next.pickbanDraft ?? {
					games: [1, 2, 3].map((n) => emptyGameDraft(n, teamSize, teamSize)),
					currentGame: 1,
				};
				setDraft(initialDraft);
				lastSavedDraft.current = JSON.stringify(initialDraft);
				return;
			}
			// 본인 dirty (lastSavedDraft 와 다름) 면 incoming pickbanDraft 무시.
			// 본인의 다음 PUT 이 last-write-wins 로 정렬됨.
			const localSerialized = draft ? JSON.stringify(draft) : "";
			const isLocalDirty = localSerialized !== lastSavedDraft.current;
			if (!isLocalDirty && next.pickbanDraft) {
				setDraft(next.pickbanDraft);
				lastSavedDraft.current = JSON.stringify(next.pickbanDraft);
			}
			// detail.games (기록된 게임) 은 server-only — onApply 가 아니라 swr.data
			// 가 자동 swap 되어 화면에 즉시 반영됨.
		},
	});
	const detail = detailSwr.data;
	const error = detailSwr.error;

	// SWR — champions 카탈로그 (시리즈 무관, 별도 캐시 단위).
	const champFetcher = useCallback(
		() => api<{ champions: Champion[] }>("/champions").then((r) => r.champions),
		[],
	);
	const champSwr = useStaleWhileRevalidate<Champion[]>("champions", champFetcher);
	const champions = useMemo(() => champSwr.data ?? [], [champSwr.data]);

	// series topic 구독 — 다른 사용자 변경 시 background refresh (플리커 X).
	useEffect(() => {
		if (seriesId === null) return;
		return wsClient.subscribe(`series:${seriesId}`, () => {
			detailSwr.refresh();
			showToast("다른 운영자가 픽/밴/결과를 입력했습니다");
		});
	}, [seriesId, detailSwr]);

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

	// 1/2/3 단축키 — 게임 탭 전환. design_upgrade.md §4.5.
	// 반드시 early return 이전에 등록 — Rules of Hooks (조건부 hook 호출 금지).
	useEffect(() => {
		if (!draft) return;
		const completedSet = new Set(detail?.games.map((g) => g.gameNumber) ?? []);
		const enabledFor = (n: number) => n === 1 || completedSet.has(n - 1);
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "1" && e.key !== "2" && e.key !== "3") return;
			const tag = (document.activeElement as HTMLElement | null)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return;
			const n = Number(e.key);
			if (!enabledFor(n)) return;
			e.preventDefault();
			setDraft((prev) => (prev ? { ...prev, currentGame: n } : prev));
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [draft, detail]);

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
				<button type="button" className="btn btn-sm btn-outline" onClick={detailSwr.refresh}>
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
	const team2Side: Side | null = team1Side === "BLUE" ? "RED" : team1Side === "RED" ? "BLUE" : null;

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
			detailSwr.refresh();
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
						시리즈 #{detail.series.id} · {teamSize}v{teamSize} · {detail.games.length}/3 게임 완료
						{seriesCompleted && <span className="ml-2 badge badge-success badge-sm">시리즈 종료</span>}
					</p>
				</div>
				<div className="flex items-center gap-1">
					<button
						type="button"
						className="btn btn-sm btn-ghost"
						onClick={detailSwr.refresh}
						title="새로고침"
						aria-label="새로고침"
					>
						↻
					</button>
					{perms.canEdit && (noGamesPlayed || !seriesCompleted) && (
						<div className="dropdown dropdown-end">
							<div tabIndex={0} role="button" className="btn btn-sm btn-ghost" aria-label="더 보기">
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

			{!perms.canEdit && !readOnlyDismissed && (
				<div className="alert alert-warning">
					<span>👁 관전 중 — 운영자가 픽/밴/결과를 입력하면 자동으로 갱신됩니다.</span>
					<button
						type="button"
						className="btn btn-ghost btn-xs"
						onClick={() => {
							if (readOnlyDismissKey) sessionStorage.setItem(readOnlyDismissKey, "1");
							setReadOnlyDismissed(true);
						}}
						aria-label="알림 닫기"
					>
						✕
					</button>
				</div>
			)}
			{!perms.canEdit && readOnlyDismissed && !seriesCompleted && (
				<div className="text-xs text-base-content/60 flex items-center gap-1.5">
					<span className="size-1.5 rounded-full bg-success animate-pulse" aria-hidden />
					라이브 — 운영자 입력 시 자동 갱신
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
							<LineupPreview
								participants={detail.participants}
								compact
								{...(onSelectUser ? { onSelectUser } : {})}
							/>
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
						<h3 className="font-bold text-sm">Game {draft.currentGame} — 1팀이 어느 사이드인가요?</h3>
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

			{/* Game 1 사이드 결정 + 첫 게임 미기록 + 시리즈 진행중 일 때만 밸런스 이미지 노출 */}
			{team1Side && draft.currentGame === 1 && !completedGames.has(1) && !seriesCompleted && (
				<BalancePreview team1Side={team1Side} participants={detail.participants} />
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
							const games = prev.games.map((x, i) => (i === prev.currentGame - 1 ? g : x));
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
					onRecorded={detailSwr.refresh}
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
