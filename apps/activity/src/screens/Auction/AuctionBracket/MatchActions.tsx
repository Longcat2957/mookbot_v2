import { api } from "../../../api/rest.js";
import { ConfirmButton } from "../../../components/ConfirmButton.js";
import type { AuctionMatch } from "../types.js";
import { MatchFormatToggle } from "./MatchFormatToggle.js";

export function MatchActions({
	match,
	gamesLength,
	expanded,
	onExpandedChange,
	onRefresh,
}: {
	match: AuctionMatch;
	gamesLength: number;
	expanded: boolean;
	onExpandedChange: (expanded: boolean) => void;
	onRefresh: () => void;
}) {
	return (
		<div className="flex gap-1.5 flex-wrap">
			<button
				type="button"
				className="btn btn-primary flex-1"
				onClick={() => onExpandedChange(!expanded)}
			>
				{expanded ? "접기" : `Game ${gamesLength + 1} 입력`}
			</button>
			{gamesLength === 0 && (
				<MatchFormatToggle matchId={match.matchId} format={match.format} onChanged={onRefresh} />
			)}
			{gamesLength > 0 && (
				<ConfirmButton
					label="↺ 직전 게임"
					onConfirm={async () => {
						await api(`/auction-matches/${match.matchId}/games/last`, {
							method: "DELETE",
						});
						onRefresh();
					}}
					variant="error"
					className="btn"
				/>
			)}
		</div>
	);
}
