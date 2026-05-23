import { PanelCard, StatusBadge } from "../../../components/DesignPrimitives.js";
import { UserAvatar } from "../../../components/UserAvatar.js";
import type { AuctionTournamentDetail } from "../types.js";

export function UnsoldList({ unsold }: { unsold: AuctionTournamentDetail["unsold"] }) {
	if (unsold.length === 0) return null;

	return (
		<PanelCard status="warning" bodyClassName="p-3 gap-2">
			<h3 className="text-sm font-bold">🟡 유찰 ({unsold.length})</h3>
			<div className="flex flex-wrap gap-1.5">
				{unsold.map((u) => (
					<StatusBadge key={u.userId} tone="warning" size="sm" className="gap-1 px-1.5">
						<UserAvatar
							discordId={u.userId}
							displayName={u.displayName}
							imageUrl={u.profileIconUrl}
							size="xs"
						/>
						<span className="text-xs font-medium">{u.displayName}</span>
					</StatusBadge>
				))}
			</div>
		</PanelCard>
	);
}
