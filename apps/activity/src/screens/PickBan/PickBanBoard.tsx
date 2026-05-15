import { markRender } from "../../debug/renderMetrics.js";
import { ActiveSlotToolbar } from "./ActiveSlotToolbar.js";
import { BulkInput } from "./BulkInput.js";
import { ChampionPanel } from "./ChampionPanel.js";
import { TeamColumn } from "./TeamColumn.js";
import type { Champion, GameDraft, PickUsage, SeriesParticipant, Side } from "./types.js";
import { usePickBanBoardState } from "./usePickBanBoardState.js";

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
	markRender("PickBanBoard");
	const board = usePickBanBoardState({
		teamSize,
		gameDraft,
		team1Side,
		participants,
		champions,
		fearlessUsedIds,
		onChange,
	});

	return (
		<div className="space-y-4">
			<ActiveSlotToolbar
				info={board.activeSlotInfo}
				autoAdvance={board.autoAdvance}
				orderMode={board.orderMode}
				showOrderMode={teamSize === 5 && Boolean(team1Side)}
				onAutoAdvanceChange={board.setAutoAdvance}
				onOrderModeChange={board.setOrderMode}
				onCancel={board.clearActiveSlot}
			/>

			{board.perms.canEdit && (
				<BulkInput champions={champions} teamSize={teamSize} onApply={board.handleApplyBulk} />
			)}

			<div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 items-start">
				<div className="space-y-3 min-w-0 lg:min-h-[calc(100vh-1rem)]">
					<TeamColumn
						team="TEAM_1"
						side={team1Side}
						teamSize={teamSize}
						draft={gameDraft}
						lineup={board.lineup}
						champions={champions}
						activeSlot={board.activeSlot}
						onSlotClick={board.handleSlotClick}
					/>
					<TeamColumn
						team="TEAM_2"
						side={board.team2Side}
						teamSize={teamSize}
						draft={gameDraft}
						lineup={board.lineup}
						champions={champions}
						activeSlot={board.activeSlot}
						onSlotClick={board.handleSlotClick}
					/>
				</div>

				<ChampionPanel
					searchRef={board.searchRef}
					search={board.search}
					onSearchChange={board.setSearch}
					onClearSearch={board.clearSearch}
					activeSlot={board.activeSlot}
					activePlayer={board.activePlayer}
					filterMode={board.filterMode}
					onFilterModeChange={board.setFilterMode}
					fearlessUsedIds={fearlessUsedIds}
					mains={board.mains}
					usable={board.usable}
					blocked={board.blocked}
					previousPicks={previousPicks}
					onCommitChampion={board.commitChampion}
				/>
			</div>
		</div>
	);
}
