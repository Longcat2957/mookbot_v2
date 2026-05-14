import { UserAvatar } from "../../components/UserAvatar.js";
import { useCoarsePointer } from "../../state/useCoarsePointer.js";
import { ChampionTile } from "./ChampionTile.js";
import { type Participant, ROLE_LABEL } from "./types.js";

export function ParticipantCard({
	participant,
	compact = false,
	selected = false,
	onTap,
	recentlyChanged = false,
}: {
	participant: Participant;
	compact?: boolean;
	selected?: boolean;
	onTap?: () => void;
	recentlyChanged?: boolean;
}) {
	const { displayName, roles, history } = participant;
	const totalWr =
		history.total.plays > 0 ? Math.round((history.total.wins / history.total.plays) * 100) : 0;
	// touch 환경에서는 HTML5 DnD 가 작동 안 함 — draggable 비활성 + cursor 도 pointer.
	// tap-to-place 만 노출되어 사용자가 잡고 끌려는 시도를 안 함.
	const coarse = useCoarsePointer();

	return (
		<div
			draggable={!coarse}
			role={onTap ? "button" : undefined}
			tabIndex={onTap ? 0 : undefined}
			onDragStart={
				coarse
					? undefined
					: (e) => {
							e.dataTransfer.setData("text/plain", participant.userId);
							e.dataTransfer.effectAllowed = "move";
						}
			}
			onClick={onTap}
			onKeyDown={(e) => {
				if (onTap && (e.key === "Enter" || e.key === " ")) {
					e.preventDefault();
					onTap();
				}
			}}
			className={`bg-base-300 rounded-lg ${coarse ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"} hover:bg-base-content/10 transition px-3 py-2 flex items-center gap-2 min-w-0 ${
				selected
					? "ring-2 ring-primary bg-primary/10"
					: recentlyChanged
						? "ring-2 ring-info animate-pulse"
						: ""
			}`}
		>
			{/* 좌: avatar */}
			<UserAvatar
				discordId={participant.userId}
				displayName={displayName}
				size="sm"
				imageUrl={participant.profileIconUrl ?? null}
			/>

			{/* 중: 이름 + 메타 */}
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2 mb-0.5">
					<span className="font-bold text-base truncate">{displayName}</span>
					{history.total.plays > 0 ? (
						<span
							className={`text-xs font-bold tabular-nums ${totalWr >= 50 ? "text-success" : "text-error"}`}
						>
							{totalWr}%
						</span>
					) : (
						<span className="badge badge-ghost badge-xs">신규</span>
					)}
					{history.total.plays > 0 && (
						<span className="text-[10px] opacity-50 tabular-nums">
							{history.total.wins}-{history.total.losses}
						</span>
					)}
				</div>
				<div className="flex items-center gap-1 flex-wrap">
					{roles.length > 0 && (
						<>
							{roles.map((r) => (
								<span key={r} className="badge badge-primary badge-xs">
									{ROLE_LABEL[r] ?? r}
								</span>
							))}
							<span className="opacity-30 mx-0.5">|</span>
						</>
					)}
					{history.topRole && history.topRole.plays > 0 && (
						<span className="badge badge-outline badge-xs">
							주 {ROLE_LABEL[history.topRole.role] ?? history.topRole.role}
						</span>
					)}
					{history.total.plays === 0 && (
						<span className="text-[10px] text-base-content/50 italic">전적 없음</span>
					)}
				</div>
			</div>

			{/* 우: 챔프 아이콘 5개 */}
			{history.topChampions.length > 0 && !compact && (
				<div className="flex gap-0.5 shrink-0">
					{history.topChampions.map((c) => (
						<ChampionTile key={c.championId} champ={c} />
					))}
				</div>
			)}
		</div>
	);
}
