// [4] 픽/밴 + 결과
// 게임별로 1팀/2팀이 BLUE/RED 어느 쪽으로 시작할지 선택 + 5밴 + 5픽 + 결과.
// pickban draft 는 series 단위로 guild_kv 에 JSON 보관, Activity 재실행 시 복원.
//
// 상태 / SWR / 저장 / WS / derived 는 ./PickBan/usePickBanState.ts 에 응집.
// 이 파일은 layout + props wiring 만.

import { useEffect, useMemo, useState } from "react";
import { BalancePreview } from "../components/BalancePreview.js";
import { ConfirmButton } from "../components/ConfirmButton.js";
import { type Hint, KeyboardHints } from "../components/KeyboardHints.js";
import { LineupPreview } from "../components/LineupPreview.js";
import { SaveStatusIndicator } from "../components/SaveStatus.js";
import { usePerms } from "../state/perms.js";
import { PickBanBoard } from "./PickBan/PickBanBoard.js";
import { PickBanSkeleton } from "./PickBan/PickBanSkeleton.js";
import { ResultPanel } from "./PickBan/ResultPanel.js";
import { type PickUsage, sideTextColor } from "./PickBan/types.js";
import { usePickBanState } from "./PickBan/usePickBanState.js";

const PICKBAN_HINTS: Hint[] = [
	{ keys: ["/"], label: "검색" },
	{ keys: ["Tab"], label: "다음 슬롯" },
	{ keys: ["Enter"], label: "첫 챔프" },
	{ keys: ["Backspace"], label: "삭제" },
	{ keys: ["B"], label: "BLUE" },
	{ keys: ["R"], label: "RED" },
	{ keys: ["1"], label: "1팀 승" },
	{ keys: ["2"], label: "2팀 승" },
	{ keys: ["Ctrl", "Enter"], label: "기록" },
	{ keys: ["Ctrl", "1"], label: "Game 전환" },
];

export function PickBan({
	seriesId,
	onBack,
	onSelectUser,
}: {
	seriesId: number | null;
	onBack: () => void;
	onSelectUser?: (userId: string) => void;
}) {
	const perms = usePerms();
	const s = usePickBanState({ seriesId });

	// 관전 모드 alert dismissible (세션 단위) — design_upgrade.md §6.7
	const readOnlyDismissKey = seriesId !== null ? `readonly-dismissed-series-${seriesId}` : "";
	const [readOnlyDismissed, setReadOnlyDismissed] = useState(false);
	useEffect(() => {
		if (!readOnlyDismissKey) return;
		setReadOnlyDismissed(sessionStorage.getItem(readOnlyDismissKey) === "1");
	}, [readOnlyDismissKey]);

	// W4 — Bo3 자동 사이드 반전 (localStorage 영속, default ON).
	const [autoSideFlip, setAutoSideFlip] = useState<boolean>(() => {
		try {
			return localStorage.getItem("pickban:autoSideFlip") !== "0";
		} catch {
			return true;
		}
	});
	useEffect(() => {
		try {
			localStorage.setItem("pickban:autoSideFlip", autoSideFlip ? "1" : "0");
		} catch {}
	}, [autoSideFlip]);

	// 새 게임 진입 시 이전 게임 사이드의 반대로 default 설정.
	// 사이드 이미 결정되어 있으면 (사용자 수동 변경 / 직전 unflip) 변경 X.
	useEffect(() => {
		if (!autoSideFlip) return;
		if (!perms.canEdit) return;
		if (!s.detail || !s.draft) return;
		const currentGame = s.draft.currentGame;
		const currentDraft = s.draft.games.find((g) => g.gameNumber === currentGame);
		if (!currentDraft || currentDraft.team1Side !== null) return;
		const prev = s.detail.games.find((g) => g.gameNumber === currentGame - 1);
		if (!prev) return;
		s.setSide(prev.team1Side === "BLUE" ? "RED" : "BLUE");
	}, [autoSideFlip, perms.canEdit, s.detail, s.draft, s.setSide]);

	// W3 — 이전 게임 챔프 사용 정보 map (현재 게임 이전만). null guard 로 early return 호환.
	const previousPicks = useMemo<Map<number, PickUsage[]>>(() => {
		const map = new Map<number, PickUsage[]>();
		if (!s.detail || !s.draft) return map;
		const currentGame = s.draft.currentGame;
		for (const g of s.detail.games) {
			if (g.gameNumber >= currentGame) continue;
			const win1 = g.winningTeam === "TEAM_1";
			for (const p of g.picks) {
				if (p.championId == null) continue;
				const win = (p.team === "TEAM_1") === win1;
				const list = map.get(p.championId) ?? [];
				list.push({ gameNumber: g.gameNumber, team: p.team, role: p.role, win });
				map.set(p.championId, list);
			}
		}
		return map;
	}, [s.detail, s.draft]);

	if (seriesId === null) {
		return (
			<div className="alert alert-warning">
				<span>시리즈를 먼저 선택해주세요.</span>
			</div>
		);
	}
	if (s.error) {
		return (
			<div className="space-y-3">
				<div className="alert alert-error">
					<span>시리즈 정보를 불러오지 못했습니다: {s.error}</span>
				</div>
				<button type="button" className="btn btn-sm btn-outline" onClick={s.refresh}>
					↻ 새로고침
				</button>
			</div>
		);
	}
	if (!s.detail || !s.draft || !s.currentGameDraft) return <PickBanSkeleton />;

	const detail = s.detail;
	const draft = s.draft;
	const currentGameDraft = s.currentGameDraft;
	const team1Side = s.team1Side;
	const team2Side = s.team2Side;

	const handleRevert = async () => {
		if (await s.revert()) onBack();
	};

	// W1 키보드 단축키 — Ctrl+1/2/3 (Game 탭) + B/R (사이드 결정 시).
	// IME 한글 자모 조합 중에는 isComposing 으로 skip.
	useEffect(() => {
		if (!perms.canEdit) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.isComposing) return;
			const tag = (document.activeElement as HTMLElement | null)?.tagName;
			const isInInput = tag === "INPUT" || tag === "TEXTAREA";

			// Ctrl+1/2/3 — Game 탭 전환 (input focus 여도 동작)
			if (e.ctrlKey && (e.key === "1" || e.key === "2" || e.key === "3")) {
				const n = Number(e.key);
				if (s.isGameTabEnabled(n)) {
					e.preventDefault();
					s.setCurrentGame(n);
				}
				return;
			}

			// B/R — 사이드 미결정 시. input focus 시 skip (native 타이핑).
			if (!team1Side && !isInInput && (e.key === "b" || e.key === "B")) {
				e.preventDefault();
				s.setSide("BLUE");
				return;
			}
			if (!team1Side && !isInInput && (e.key === "r" || e.key === "R")) {
				e.preventDefault();
				s.setSide("RED");
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [perms.canEdit, team1Side, s.isGameTabEnabled, s.setCurrentGame, s.setSide]);

	return (
		<section className="space-y-3">
			<header className="flex items-center justify-between flex-wrap gap-2">
				<div>
					<h2 className="text-xl font-bold flex items-center gap-3">
						픽 / 밴
						{perms.canEdit && (
							<SaveStatusIndicator status={s.saveStatus} savedAt={s.savedAt} onRetry={s.retrySave} />
						)}
					</h2>
					<p className="text-xs text-base-content/70">
						시리즈 #{detail.series.id} · {s.teamSize}v{s.teamSize} · {detail.games.length}/3 게임 완료
						{s.seriesCompleted && <span className="ml-2 badge badge-success badge-sm">시리즈 종료</span>}
					</p>
				</div>
				<div className="flex items-center gap-1">
					<button
						type="button"
						className="btn btn-sm btn-ghost"
						onClick={s.refresh}
						title="새로고침"
						aria-label="새로고침"
					>
						↻
					</button>
					{perms.canEdit && (s.noGamesPlayed || !s.seriesCompleted) && (
						<div className="dropdown dropdown-end">
							<div tabIndex={0} role="button" className="btn btn-sm btn-ghost" aria-label="더 보기">
								⋯
							</div>
							<div
								tabIndex={0}
								className="dropdown-content bg-base-100 rounded-box z-30 w-64 p-2 shadow-lg border border-base-300 space-y-1"
							>
								<div className="text-xs uppercase tracking-wide text-base-content/60 px-2 pt-1 pb-0.5">
									설정
								</div>
								<label className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-base-200 rounded">
									<input
										type="checkbox"
										className="toggle toggle-xs toggle-info"
										checked={autoSideFlip}
										onChange={(e) => setAutoSideFlip(e.target.checked)}
									/>
									<span className="text-sm">Bo3 자동 사이드 반전</span>
								</label>
								<div className="text-[10px] text-base-content/50 px-2 pb-1 leading-snug">
									Game 2/3 진입 시 이전 게임 사이드의 반대로 default.
								</div>
								<div className="divider my-1" />
								<div className="text-xs uppercase tracking-wide text-base-content/60 px-2 pt-1 pb-0.5">
									위험한 액션
								</div>
								{!s.noGamesPlayed && (
									<ConfirmButton
										label="↺ 직전 게임 되돌리기"
										onConfirm={s.undoLast}
										variant="error"
										className="w-full justify-start"
									/>
								)}
								{s.noGamesPlayed && (
									<ConfirmButton
										label="↩ 엔트리 수정 대기로"
										onConfirm={handleRevert}
										variant="warning"
										className="w-full justify-start"
									/>
								)}
								<div className="text-[10px] text-base-content/50 px-2 pt-1 leading-snug">
									{!s.noGamesPlayed
										? "직전 게임 결과 + MMR 변동을 취소합니다."
										: "시리즈를 삭제하고 모집을 엔트리 수정 대기 상태로 되돌립니다."}
								</div>
							</div>
						</div>
					)}
				</div>
			</header>

			{s.actionError && (
				<div className="alert alert-error">
					<span>{s.actionError}</span>
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
			{!perms.canEdit && readOnlyDismissed && !s.seriesCompleted && (
				<div className="text-xs text-base-content/60 flex items-center gap-1.5">
					<span className="size-1.5 rounded-full bg-success animate-pulse" aria-hidden />
					라이브 — 운영자 입력 시 자동 갱신
				</div>
			)}

			{/* W6 — 키 hint 패널 (운영자 모드만) */}
			{perms.canEdit && !s.seriesCompleted && (
				<KeyboardHints hints={PICKBAN_HINTS} storageKey="pickban:hints:dismissed" />
			)}

			{/* 시리즈 스코어 + 라인업 — 단일 카드 (라인업 collapse) */}
			<div
				className={`card bg-base-200 shadow-sm ${s.seriesCompleted ? "border border-success" : ""}`}
			>
				<div className="card-body p-4 gap-3">
					<div className="flex items-end gap-4 flex-wrap">
						<div className="flex items-end gap-3 tabular-nums">
							<div className="text-center">
								<div className="text-[10px] uppercase tracking-wide text-info">1팀</div>
								<div className="text-3xl font-bold leading-none text-info">{s.t1Wins}</div>
							</div>
							<div className="text-2xl opacity-30 leading-none pb-1">:</div>
							<div className="text-center">
								<div className="text-[10px] uppercase tracking-wide text-error">2팀</div>
								<div className="text-3xl font-bold leading-none text-error">{s.t2Wins}</div>
							</div>
						</div>
						<div className="text-xs text-base-content/60 ml-1">
							Bo3 · {detail.games.length}/3 게임
							{!s.seriesCompleted && ` · Game ${draft.currentGame} 진행 중`}
						</div>
						{s.seriesCompleted && detail.series.winningTeam && (
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
					const enabled = s.isGameTabEnabled(n);
					const recorded = s.completedGames.has(n);
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
							onClick={() => s.setCurrentGame(n)}
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
					{!s.isCurrentGameRecorded && perms.canEdit && (
						<button
							type="button"
							className="btn btn-xs btn-ghost"
							onClick={() => s.setSide(team1Side === "BLUE" ? "RED" : "BLUE")}
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
								onClick={() => s.setSide("BLUE")}
								className="btn h-auto flex-col py-3 bg-info/10 border-info text-info hover:bg-info hover:text-info-content"
								disabled={!perms.canEdit}
							>
								<span className="text-xs opacity-80">1팀 사이드</span>
								<span className="text-lg font-bold">BLUE</span>
								{perms.canEdit && <kbd className="kbd kbd-xs mt-0.5">B</kbd>}
							</button>
							<button
								type="button"
								onClick={() => s.setSide("RED")}
								className="btn h-auto flex-col py-3 bg-error/10 border-error text-error hover:bg-error hover:text-error-content"
								disabled={!perms.canEdit}
							>
								<span className="text-xs opacity-80">1팀 사이드</span>
								<span className="text-lg font-bold">RED</span>
								{perms.canEdit && <kbd className="kbd kbd-xs mt-0.5">R</kbd>}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Game 1 사이드 결정 + 첫 게임 미기록 + 시리즈 진행중 일 때만 밸런스 이미지 노출 */}
			{team1Side && draft.currentGame === 1 && !s.completedGames.has(1) && !s.seriesCompleted && (
				<BalancePreview team1Side={team1Side} participants={detail.participants} />
			)}

			{team1Side && (
				<PickBanBoard
					teamSize={s.teamSize}
					gameDraft={currentGameDraft}
					team1Side={team1Side}
					participants={detail.participants}
					champions={s.champions}
					fearlessUsedIds={s.fearlessUsedIds}
					previousPicks={previousPicks}
					onChange={s.setGameDraft}
				/>
			)}

			{/* 결과 입력 — 슬롯 다 채워졌고 사이드 결정 + 미기록 게임일 때만 노출 */}
			{team1Side && !s.isCurrentGameRecorded && !s.seriesCompleted && (
				<ResultPanel
					seriesId={seriesId}
					gameDraft={currentGameDraft}
					teamSize={s.teamSize}
					participants={detail.participants}
					champions={s.champions}
					onRecorded={s.refresh}
				/>
			)}

			{/* 게임 N 이미 기록됨 안내 */}
			{s.isCurrentGameRecorded && (
				<div className="alert alert-success">
					<span>Game {draft.currentGame} 결과가 이미 기록되었습니다.</span>
				</div>
			)}
		</section>
	);
}
