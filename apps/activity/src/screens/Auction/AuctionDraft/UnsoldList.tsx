import { PanelCard, StatusBadge } from "../../../components/DesignPrimitives.js";
import { UserAvatar } from "../../../components/UserAvatar.js";
import type { AuctionTournamentDetail } from "../types.js";

export function UnsoldList({ unsold }: { unsold: AuctionTournamentDetail["unsold"] }) {
	if (unsold.length === 0) return null;

	return (
		<PanelCard status="warning" bodyClassName="p-4 gap-2">
			<h3 className="text-base font-bold">🟡 유찰 ({unsold.length}) — 재경매 대기</h3>
			<div className="flex flex-wrap gap-2">
				{unsold.map((u) => (
					<StatusBadge key={u.userId} tone="warning" size="lg" className="gap-1.5 py-3 px-2">
						<UserAvatar
							discordId={u.userId}
							displayName={u.displayName}
							imageUrl={u.profileIconUrl}
							size="xs"
						/>
						<span className="text-sm font-medium">{u.displayName}</span>
					</StatusBadge>
				))}
			</div>
			<p className="text-sm text-base-content/60">
				🎲 다음 인원 으로 재추출 또는 ➕ 수동 으로 직접 배치하세요.
			</p>
		</PanelCard>
	);
}
