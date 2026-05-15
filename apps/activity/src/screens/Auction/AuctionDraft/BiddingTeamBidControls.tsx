import type { AuctionTournamentDetail } from "../types.js";

export function BiddingTeamBidControls({
	team,
	isBidding,
	canEdit,
	submitting,
	full,
	sharedIntent,
	localValue,
	onBidInput,
	onFinalize,
	onManualAssign,
}: {
	team: AuctionTournamentDetail["teams"][number];
	isBidding: boolean;
	canEdit: boolean;
	submitting: boolean;
	full: boolean;
	sharedIntent: number | undefined;
	localValue: string;
	onBidInput: (teamId: number, value: string) => void;
	onFinalize: (teamId: number) => void;
	onManualAssign: (teamId: number) => void;
}) {
	if (!isBidding) return null;
	if (full) {
		return (
			<div className="text-xs text-base-content/40 text-center surface-quiet-soft rounded-md py-1.5">
				팀원 모집 완료
			</div>
		);
	}
	if (!canEdit) {
		return sharedIntent !== undefined ? (
			<div className="flex items-center gap-2 surface-quiet-soft rounded-md p-1.5 text-sm">
				<span className="text-base-content/60">현재 입찰</span>
				<span className="ml-auto font-bold tabular-nums text-warning">{sharedIntent}p</span>
			</div>
		) : (
			<div className="text-xs text-base-content/40 text-center surface-quiet-soft rounded-md py-1.5">
				입찰 대기
			</div>
		);
	}

	return (
		<div className="flex items-center gap-1.5 surface-quiet-soft rounded-md p-1.5">
			<input
				type="number"
				placeholder="입찰가"
				value={localValue}
				onChange={(e) => onBidInput(team.id, e.target.value)}
				min={0}
				className="input input-bordered input-sm flex-1 text-right tabular-nums"
				aria-label={`팀${team.teamIndex} 입찰가`}
			/>
			<button
				type="button"
				className="btn btn-success btn-sm"
				onClick={() => onFinalize(team.id)}
				disabled={submitting}
			>
				✓ 낙찰
			</button>
			<button
				type="button"
				className="btn btn-ghost btn-sm"
				onClick={() => onManualAssign(team.id)}
				disabled={submitting}
				title="포인트 무관 수동 배치"
			>
				➕
			</button>
		</div>
	);
}
