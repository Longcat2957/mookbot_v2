import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePerms } from "../../state/perms.js";
import { BulkInput } from "./BulkInput.js";
import { ChampCell } from "./ChampCell.js";
import { nextSlotForAdvance, type OrderMode } from "./pickbanOrder.js";
import { TeamColumn } from "./TeamColumn.js";
import {
	type ActiveSlot,
	allSlots,
	type Champion,
	type ChampionPlay,
	type GameDraft,
	LANE_LABEL,
	LANE_ORDER,
	type PickUsage,
	type SeriesParticipant,
	type Side,
	sameSlot,
	type Team,
} from "./types.js";

export function PickBanBoard({
	teamSize,
	gameDraft,
	team1Side,
	participants,
	champions,
	fearlessUsedIds,
	previousPicks,
	onChange,
}: {
	teamSize: number;
	gameDraft: GameDraft;
	team1Side: Side;
	participants: SeriesParticipant[];
	champions: Champion[];
	fearlessUsedIds: Set<number>;
	previousPicks?: Map<number, PickUsage[]>;
	onChange: (g: GameDraft) => void;
}) {
	// 일괄 입력 — 콤마 split 후 슬롯에 차례로 채움.
	// null = 빈 토큰 또는 매칭 실패 → 기존 슬롯 값 유지 (불필요한 clear 회피).
	// "모두 적용" 시 4영역 변경을 한 번의 onChange 로 묶는다 — 연속 setState 시
	// 비동기 batching 으로 마지막 호출만 누적되던 버그 (v0.3.21 까지) 수정.
	const handleApplyBulk = (
		changes: { team: Team; kind: "ban" | "pick"; championIds: (number | null)[] }[],
	) => {
		if (changes.length === 0) return;
		const next: GameDraft = {
			...gameDraft,
			bans: { TEAM_1: [...gameDraft.bans.TEAM_1], TEAM_2: [...gameDraft.bans.TEAM_2] },
			picks: { TEAM_1: [...gameDraft.picks.TEAM_1], TEAM_2: [...gameDraft.picks.TEAM_2] },
		};
		for (const { team, kind, championIds } of changes) {
			const arr = kind === "ban" ? next.bans[team] : next.picks[team];
			for (let j = 0; j < championIds.length && j < arr.length; j++) {
				const cid = championIds[j];
				if (cid !== null && cid !== undefined) arr[j] = cid;
			}
		}
		onChange(next);
	};
	const perms = usePerms();
	const [search, setSearch] = useState("");
	const [activeSlot, setActiveSlot] = useState<ActiveSlot | null>(null);
	const searchRef = useRef<HTMLInputElement | null>(null);

	// W2 — 자동 advance / 순서 모드 (localStorage 영속). 사용자 결정: autoAdvance default ON / order free.
	const [autoAdvance, setAutoAdvance] = useState<boolean>(() => {
		try {
			return localStorage.getItem("pickban:autoAdvance") !== "0";
		} catch {
			return true;
		}
	});
	useEffect(() => {
		try {
			localStorage.setItem("pickban:autoAdvance", autoAdvance ? "1" : "0");
		} catch {}
	}, [autoAdvance]);
	const [orderMode, setOrderMode] = useState<OrderMode>(() => {
		try {
			const v = localStorage.getItem("pickban:orderMode");
			return v === "lol" ? "lol" : "free";
		} catch {
			return "free";
		}
	});
	useEffect(() => {
		try {
			localStorage.setItem("pickban:orderMode", orderMode);
		} catch {}
	}, [orderMode]);

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

	// 활성 픽 슬롯의 플레이어 — MY MAINS 추출용 (design_upgrade.md §6.4.3)
	const activePlayer = useMemo<SeriesParticipant | null>(() => {
		if (!activeSlot || activeSlot.kind !== "pick") return null;
		const lane = LANE_ORDER[activeSlot.idx];
		if (!lane) return null;
		return participants.find((p) => p.team === activeSlot.team && p.role === lane) ?? null;
	}, [activeSlot, participants]);

	// MY MAINS / 사용 가능 / 사용 불가 — 3 섹션 분리
	const { mains, usable, blocked } = useMemo(() => {
		const filteredIds = new Set(filtered.map((c) => c.id));
		const mainsSet = activePlayer
			? new Set(activePlayer.history.topChampions.map((c) => c.championId))
			: new Set<number>();

		const mains: ChampionPlay[] = [];
		if (activePlayer) {
			for (const c of activePlayer.history.topChampions) {
				if (!filteredIds.has(c.championId)) continue;
				if (fearlessUsedIds.has(c.championId)) continue;
				if (usedIds.has(c.championId)) continue;
				mains.push(c);
			}
		}

		const usable: Champion[] = [];
		const blocked: { champ: Champion; reason: "used" | "fearless" }[] = [];
		for (const c of filtered) {
			if (fearlessUsedIds.has(c.id)) {
				blocked.push({ champ: c, reason: "fearless" });
			} else if (usedIds.has(c.id)) {
				blocked.push({ champ: c, reason: "used" });
			} else if (mainsSet.has(c.id)) {
			} else {
				usable.push(c);
			}
		}
		return { mains, usable, blocked };
	}, [filtered, usedIds, fearlessUsedIds, activePlayer]);

	const [filterMode, setFilterMode] = useState<"all" | "mains">("all");
	// 활성 슬롯 변경 시 필터 모드 reset
	useEffect(() => {
		setFilterMode("all");
	}, [activeSlot]);

	const lineup = useMemo(() => {
		const map = new Map<string, string>();
		for (const p of participants) map.set(`${p.team}_${p.role}`, p.displayName);
		return map;
	}, [participants]);

	const setSlot = useCallback(
		(championId: number | null) => {
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
			const arr = activeSlot.kind === "ban" ? next.bans[activeSlot.team] : next.picks[activeSlot.team];
			arr[activeSlot.idx] = championId;
			onChange(next);
		},
		[activeSlot, gameDraft, onChange],
	);

	// W2 — 챔프 채움 + 자동 advance. setSlot(null) 슬롯 지우기와 분리.
	//   autoAdvance=ON: 다음 슬롯 (orderMode 따라) 자동 활성 / null 이면 모두 채워짐 → 해제.
	//   autoAdvance=OFF: 슬롯 해제만 (기존 동작).
	const commitChampion = useCallback(
		(championId: number) => {
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
			const arr = activeSlot.kind === "ban" ? next.bans[activeSlot.team] : next.picks[activeSlot.team];
			arr[activeSlot.idx] = championId;
			onChange(next);
			setSearch("");
			if (!autoAdvance) {
				setActiveSlot(null);
				return;
			}
			setActiveSlot(nextSlotForAdvance(orderMode, activeSlot, team1Side, teamSize, next));
		},
		[activeSlot, autoAdvance, orderMode, team1Side, teamSize, gameDraft, onChange],
	);

	// W1 키보드 단축키 — Tab/Shift+Tab/Enter/Backspace (활성 슬롯 전제).
	// IME 한글 자모 조합 중에는 isComposing 으로 skip — Enter 가 자모 확정으로 가로채지 않게.
	useEffect(() => {
		if (!perms.canEdit) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.isComposing) return;
			if (!activeSlot) return;
			const tag = (document.activeElement as HTMLElement | null)?.tagName;
			const isInInput = tag === "INPUT" || tag === "TEXTAREA";
			const isInSearch = document.activeElement === searchRef.current;

			// Tab — 다음 슬롯 (Shift+Tab 이전)
			if (e.key === "Tab") {
				e.preventDefault();
				const all = allSlots(teamSize);
				const i = all.findIndex((s) => sameSlot(s, activeSlot));
				const dir = e.shiftKey ? -1 : 1;
				const ni = (i + dir + all.length) % all.length;
				setActiveSlot(all[ni] ?? null);
				return;
			}

			// Enter — 검색 input focus + 검색 결과 첫 챔프 선택 + 자동 advance
			if (e.key === "Enter" && isInSearch) {
				const first: ChampionPlay | Champion | undefined = mains[0] ?? usable[0];
				if (!first) return;
				e.preventDefault();
				const champId = "championId" in first ? first.championId : first.id;
				commitChampion(champId);
				return;
			}

			// Backspace — 활성 슬롯 비우기
			//   검색 input 안 + 검색어 있음 → native delete (skip)
			//   검색 input 안 + 검색어 빈 상태 → 슬롯 비우기
			//   input 밖 → 슬롯 비우기
			if (e.key === "Backspace") {
				const arr =
					activeSlot.kind === "ban" ? gameDraft.bans[activeSlot.team] : gameDraft.picks[activeSlot.team];
				if (arr[activeSlot.idx] == null) return;
				if (isInSearch && search) return;
				if (!isInInput || isInSearch) {
					e.preventDefault();
					setSlot(null);
				}
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [
		activeSlot,
		mains,
		usable,
		search,
		gameDraft,
		teamSize,
		setSlot,
		commitChampion,
		perms.canEdit,
	]);

	const team2Side: Side = team1Side === "BLUE" ? "RED" : "BLUE";

	// 슬롯 클릭: 같은 슬롯이 이미 active 이고 챔프가 차있으면 → 삭제. 아니면 → activate.
	const handleSlotClick = (team: Team, kind: "ban" | "pick", idx: number) => {
		if (!perms.canEdit) return;
		const arr = kind === "ban" ? gameDraft.bans[team] : gameDraft.picks[team];
		const filled = arr[idx] !== null;
		const same = activeSlot?.kind === kind && activeSlot?.team === team && activeSlot?.idx === idx;
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
			{/* 활성 슬롯 sticky 안내 — design_upgrade.md §6.4.2 #5 + W2 자동 advance 토글 */}
			{activeSlotInfo && (
				<div className="alert alert-info alert-soft sticky top-2 z-20 shadow-md flex-row items-center flex-wrap gap-2">
					<span className="flex-1 min-w-0">
						{activeSlotInfo}
						<span className="text-xs opacity-70 ml-2">— 챔프 선택 또는 슬롯 다시 클릭 (Esc 취소)</span>
					</span>
					<label className="flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap">
						<input
							type="checkbox"
							className="toggle toggle-xs toggle-info"
							checked={autoAdvance}
							onChange={(e) => setAutoAdvance(e.target.checked)}
						/>
						자동 다음
					</label>
					{teamSize === 5 && team1Side && (
						<select
							className="select select-xs select-bordered"
							value={orderMode}
							onChange={(e) => setOrderMode(e.target.value as OrderMode)}
							title="다음 슬롯 순서 — 자유 / LoL 표준"
						>
							<option value="free">자유</option>
							<option value="lol">LoL 표준</option>
						</select>
					)}
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

			{/* 일괄 입력 — 운영자만, 닫혀 있는 게 기본 */}
			{perms.canEdit && (
				<BulkInput champions={champions} teamSize={teamSize} onApply={handleApplyBulk} />
			)}

			{/* D1 split layout — 보드 좌 60% + 챔프 그리드 우 40% sticky (lg+ 만).
			    좌측 column 도 우측 max-h 와 같은 viewport 기준 min-h 부여 — 양쪽 하단 align. */}
			<div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 items-start">
				{/* 픽/밴 보드 (1팀 + 2팀 stack) — split 안에선 좌측 60% */}
				<div className="space-y-3 min-w-0 lg:min-h-[calc(100vh-1rem)]">
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

				{/* 챔프 그리드 — split 안 우측 40%, lg+ sticky (top-2 ~ 화면 끝) */}
				<div className="card bg-base-200 shadow-sm lg:sticky lg:top-2 lg:max-h-[calc(100vh-1rem)] lg:overflow-y-auto">
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
								{mains.length + usable.length} 사용 가능
								{blocked.length > 0 && ` · ${blocked.length} 사용 불가`}
							</div>
						</div>

						{activePlayer && mains.length > 0 && (
							<div role="tablist" className="tabs tabs-xs tabs-boxed self-start">
								<button
									role="tab"
									className={`tab ${filterMode === "all" ? "tab-active" : ""}`}
									onClick={() => setFilterMode("all")}
								>
									전체
								</button>
								<button
									role="tab"
									className={`tab ${filterMode === "mains" ? "tab-active" : ""}`}
									onClick={() => setFilterMode("mains")}
								>
									🌟 {activePlayer.displayName} 주력 ({mains.length})
								</button>
							</div>
						)}

						{fearlessUsedIds.size > 0 && (
							<div className="text-xs text-base-content/60">
								🛡️ Hard Fearless — 이전 게임에서 사용된 {fearlessUsedIds.size}개 챔프 자동 비활성화
							</div>
						)}

						{/* MY MAINS 섹션 — 활성 픽 슬롯의 플레이어 주력 챔프 */}
						{activePlayer && mains.length > 0 && (
							<div>
								<div className="text-xs font-medium text-warning mb-1.5 flex items-center gap-1">
									🌟 주력 챔프 ({activePlayer.displayName})
								</div>
								<div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-1.5">
									{mains.map((m) => (
										<ChampCell
											key={m.championId}
											champ={{
												id: m.championId,
												idSlug: "",
												name: m.championName,
												iconUrl: m.iconUrl,
											}}
											disabled={!activeSlot}
											mainCount={m.plays}
											reason={
												!activeSlot
													? "슬롯 먼저 선택"
													: `${m.championName} · ${m.plays}회 (${m.wins}승 ${m.losses}패)`
											}
											previousUsage={previousPicks?.get(m.championId)}
											onClick={() => commitChampion(m.championId)}
										/>
									))}
								</div>
							</div>
						)}

						{/* 일반 사용 가능 — filterMode === 'all' 에서만 */}
						{filterMode === "all" &&
							(usable.length === 0 ? (
								!mains.length && (
									<div className="text-center text-sm text-base-content/50 py-6">
										{search.trim() ? `"${search}" 검색 결과 없음` : "사용 가능한 챔프가 없습니다."}
									</div>
								)
							) : (
								<div>
									{mains.length > 0 && (
										<div className="text-xs text-base-content/60 mb-1.5">전체 ({usable.length})</div>
									)}
									<div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-1.5">
										{usable.map((c) => (
											<ChampCell
												key={c.id}
												champ={c}
												disabled={!activeSlot}
												reason={!activeSlot ? "슬롯 먼저 선택" : c.name}
												previousUsage={previousPicks?.get(c.id)}
												onClick={() => commitChampion(c.id)}
											/>
										))}
									</div>
								</div>
							))}

						{blocked.length > 0 && (
							<details className="bg-base-100/40 rounded-md">
								<summary className="cursor-pointer text-xs font-medium px-3 py-2 text-base-content/70">
									사용 불가 ({blocked.length}) — 이번 게임 사용 또는 Hard Fearless
								</summary>
								<div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-1.5 p-3 pt-0">
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
											previousUsage={previousPicks?.get(champ.id)}
										/>
									))}
								</div>
							</details>
						)}
					</div>
				</div>
				{/* /D1 split grid */}
			</div>
		</div>
	);
}
