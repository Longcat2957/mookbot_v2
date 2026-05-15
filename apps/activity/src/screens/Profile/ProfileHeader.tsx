import { UserAvatar } from "../../components/UserAvatar.js";
import type { ProfileResponse } from "./types.js";
import { winrateToneClass } from "./types.js";

export function ProfileHeader({
	data,
	isMe,
	onBack,
	onManageRiotAccounts,
}: {
	data: ProfileResponse;
	isMe: boolean;
	onBack: () => void;
	onManageRiotAccounts?: () => void;
}) {
	const totalWrPct = Math.round(data.totals.winrate * 100);

	return (
		<div className="flex items-start justify-between gap-3 flex-wrap">
			<div className="flex items-start gap-3 min-w-0 flex-1">
				<UserAvatar
					discordId={data.user.discordId}
					displayName={data.user.displayName}
					imageUrl={
						data.user.profileIconUrl ??
						data.topChampions[0]?.iconUrl ??
						data.topChampions[0]?.splashUrl ??
						null
					}
					size="xl"
					ring={isMe}
				/>
				<div className="min-w-0">
					<h1 className="text-2xl font-bold flex items-center gap-2">
						<span className="truncate">{data.user.displayName}</span>
						{isMe && <span className="badge badge-primary badge-sm">YOU</span>}
					</h1>
					<div className="text-sm text-base-content/70 flex items-center gap-2 flex-wrap mt-1">
						<span>시즌 {data.season.id}</span>
						<span className="opacity-30">·</span>
						<span>
							총 <span className="font-bold tabular-nums">{data.totals.games}</span>G ·{" "}
							<span className="text-info tabular-nums">{data.totals.wins}</span>승{" "}
							<span className="text-error tabular-nums">{data.totals.losses}</span>패{" "}
							{data.totals.games > 0 && (
								<span className={`font-medium ${winrateToneClass(totalWrPct)}`}>({totalWrPct}%)</span>
							)}
						</span>
					</div>
					<div className="flex flex-wrap gap-1.5 mt-2 items-center">
						{data.riotAccounts.map((account) => (
							<span
								key={`${account.gameName}#${account.tagLine}`}
								className={`badge badge-sm ${account.isMain ? "badge-warning" : "badge-ghost"}`}
							>
								{account.isMain && "⭐ "}
								{account.gameName}#{account.tagLine}
							</span>
						))}
						{isMe && onManageRiotAccounts && (
							<button
								type="button"
								className="btn btn-xs btn-ghost"
								onClick={onManageRiotAccounts}
								title="라이엇 계정 추가 / 메인 전환 / 해제"
							>
								✏️ 관리
							</button>
						)}
					</div>
				</div>
			</div>
			<button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
				← 돌아가기
			</button>
		</div>
	);
}
