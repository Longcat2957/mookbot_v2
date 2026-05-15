import { UserAvatar } from "../../../components/UserAvatar.js";
import type { AuctionRecruitmentDetail } from "../types.js";

export function CaptainCandidateButton({
	participant,
	selected,
	canEdit,
	onToggle,
}: {
	participant: AuctionRecruitmentDetail["participants"][number];
	selected: boolean;
	canEdit: boolean;
	onToggle: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onToggle}
			disabled={!canEdit}
			className={`flex items-center gap-2.5 p-2.5 rounded-md border-2 transition ${
				selected ? "border-warning bg-warning/15" : "border-base-300 bg-base-100 hover:bg-base-300/40"
			} ${!canEdit ? "cursor-not-allowed opacity-60" : ""}`}
			aria-pressed={selected}
		>
			<div className={selected ? "ring-2 ring-warning rounded-full" : ""}>
				<UserAvatar
					discordId={participant.userId}
					displayName={participant.displayName}
					imageUrl={participant.profileIconUrl}
					size="sm"
				/>
			</div>
			<div className="flex-1 min-w-0 text-left">
				<div className="font-bold text-base truncate">{participant.displayName}</div>
				{selected && (
					<div className="text-sm text-warning font-medium flex items-center gap-1">👑 팀장</div>
				)}
			</div>
		</button>
	);
}
