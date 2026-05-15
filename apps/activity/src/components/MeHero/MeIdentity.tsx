import { UserAvatar } from "../UserAvatar.js";
import type { MeProfileResponse, RiotAccount, TopChampion } from "./types.js";

export function MeIdentity({
	user,
	mainRiot,
	topChampion,
}: {
	user: MeProfileResponse["user"];
	mainRiot: RiotAccount | undefined;
	topChampion: TopChampion | undefined;
}) {
	const avatarUrl = user.profileIconUrl ?? topChampion?.iconUrl ?? topChampion?.splashUrl ?? null;

	return (
		<div className="flex items-start gap-3 min-w-0 flex-1">
			<UserAvatar
				discordId={user.discordId}
				displayName={user.displayName}
				imageUrl={avatarUrl}
				size="lg"
				ring
			/>
			<div className="min-w-0 flex-1">
				<div className="text-[10px] uppercase tracking-wider text-base-content/50">내 프로필</div>
				<h2 className="text-2xl font-bold leading-tight truncate flex items-center gap-2 mt-0.5">
					<span className="truncate">{user.displayName}</span>
					<span className="badge badge-primary badge-xs">YOU</span>
				</h2>
				{mainRiot && (
					<div className="text-sm text-base-content/70 truncate tabular-nums mt-0.5">
						{mainRiot.gameName}
						<span className="opacity-50">#{mainRiot.tagLine}</span>
					</div>
				)}
				{topChampion && (
					<div className="text-xs text-base-content/50 truncate mt-0.5">
						주력 <span className="font-medium text-base-content/70">{topChampion.championName}</span>
					</div>
				)}
			</div>
		</div>
	);
}
