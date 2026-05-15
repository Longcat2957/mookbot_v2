import { useCallback, useMemo, useRef, useState } from "react";
import { usePerms } from "../../state/perms.js";
import {
	applyBulkChanges,
	buildLineup,
	collectUsedIds,
	filterChampions,
	getActivePlayer,
	getActiveSlotInfo,
	getChampionBuckets,
	setDraftSlot,
} from "./pickBanBoardLogic.js";
import { nextSlotForAdvance } from "./pickbanOrder.js";
import type { ActiveSlot, Champion, GameDraft, SeriesParticipant, Side, Team } from "./types.js";
import { usePickBanBoardKeyboard } from "./usePickBanBoardKeyboard.js";
import { useStoredBoolean, useStoredOrderMode } from "./usePickBanSettings.js";

export function usePickBanBoardState({
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
	participants: SeriesParticipant[];
	champions: Champion[];
	fearlessUsedIds: Set<number>;
	onChange: (g: GameDraft) => void;
}) {
	const perms = usePerms();
	const [search, setSearch] = useState("");
	const [activeSlot, setActiveSlotRaw] = useState<ActiveSlot | null>(null);
	const searchRef = useRef<HTMLInputElement | null>(null);
	const [autoAdvance, setAutoAdvance] = useStoredBoolean("pickban:autoAdvance", true);
	const [orderMode, setOrderMode] = useStoredOrderMode();
	const [filterMode, setFilterMode] = useState<"all" | "mains">("all");
	const setActiveSlot = useCallback((slot: ActiveSlot | null) => {
		setActiveSlotRaw(slot);
		setFilterMode("all");
	}, []);

	const usedIds = useMemo(() => collectUsedIds(gameDraft), [gameDraft]);

	const filtered = useMemo(() => filterChampions(champions, search), [champions, search]);

	const activePlayer = useMemo<SeriesParticipant | null>(() => {
		return getActivePlayer(activeSlot, participants);
	}, [activeSlot, participants]);

	const { mains, usable, blocked } = useMemo(() => {
		return getChampionBuckets({ activePlayer, fearlessUsedIds, filtered, usedIds });
	}, [filtered, usedIds, fearlessUsedIds, activePlayer]);

	const lineup = useMemo(() => buildLineup(participants), [participants]);

	const setSlot = useCallback(
		(championId: number | null) => {
			if (!activeSlot) return;
			onChange(setDraftSlot(gameDraft, activeSlot, championId));
		},
		[activeSlot, gameDraft, onChange],
	);

	const commitChampion = useCallback(
		(championId: number) => {
			if (!activeSlot) return;
			const next = setDraftSlot(gameDraft, activeSlot, championId);
			onChange(next);
			setSearch("");
			if (!autoAdvance) {
				setActiveSlot(null);
				return;
			}
			setActiveSlot(nextSlotForAdvance(orderMode, activeSlot, team1Side, teamSize, next));
		},
		[activeSlot, autoAdvance, orderMode, team1Side, teamSize, gameDraft, onChange, setActiveSlot],
	);

	usePickBanBoardKeyboard({
		canEdit: perms.canEdit,
		activeSlot,
		search,
		searchRef,
		teamSize,
		gameDraft,
		mains,
		usable,
		setSearch,
		setActiveSlot,
		setSlot,
		commitChampion,
	});

	const team2Side: Side = team1Side === "BLUE" ? "RED" : "BLUE";

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

	const activeSlotInfo = useMemo(() => {
		return getActiveSlotInfo(activeSlot, lineup);
	}, [activeSlot, lineup]);

	const handleApplyBulk = (
		changes: { team: Team; kind: "ban" | "pick"; championIds: (number | null)[] }[],
	) => {
		if (changes.length === 0) return;
		onChange(applyBulkChanges(gameDraft, changes));
	};

	return {
		perms,
		search,
		setSearch,
		searchRef,
		activeSlot,
		activeSlotInfo,
		activePlayer,
		autoAdvance,
		setAutoAdvance,
		orderMode,
		setOrderMode,
		filterMode,
		setFilterMode,
		lineup,
		team2Side,
		mains,
		usable,
		blocked,
		commitChampion,
		handleSlotClick,
		handleApplyBulk,
		clearActiveSlot: () => setActiveSlot(null),
		clearSearch: () => setSearch(""),
	};
}
