import { type PreferenceChamp, ROLE_LABEL, type Role } from "./types.js";

export function LanePreferenceCard({
	role,
	champs,
	isMe,
	onEdit,
}: {
	role: Role;
	champs: PreferenceChamp[];
	isMe: boolean;
	onEdit: () => void;
}) {
	return (
		<div className="rounded-lg border border-base-300 bg-base-100 p-2.5">
			<div className="flex items-center justify-between mb-1.5">
				<div className="text-[10px] uppercase tracking-wide text-base-content/60">
					{ROLE_LABEL[role]}
				</div>
				{isMe && (
					<button
						type="button"
						onClick={onEdit}
						className="btn btn-ghost btn-xs px-1.5 min-h-0 h-6"
						aria-label={`${ROLE_LABEL[role]} 선호 챔프 편집`}
					>
						✎ 편집
					</button>
				)}
			</div>
			{champs.length === 0 ? (
				<div className="text-xs text-base-content/40 py-1">—</div>
			) : (
				<div className="flex flex-wrap gap-1">
					{champs.map((champ) => (
						<div
							key={champ.championId}
							className="flex items-center gap-1 bg-base-200/60 rounded px-1 py-0.5"
							title={champ.championName}
						>
							<img
								src={champ.iconUrl}
								alt={champ.championName}
								className="w-5 h-5 rounded"
								loading="lazy"
							/>
							<span className="text-xs">{champ.championName}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
