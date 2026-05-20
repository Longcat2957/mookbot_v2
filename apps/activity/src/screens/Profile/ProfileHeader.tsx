import { cx, StatusBadge } from "../../components/DesignPrimitives.js";
import { UserAvatar } from "../../components/UserAvatar.js";
import type { ProfileResponse } from "./types.js";
import { ROLE_LABEL, winrateToneClass } from "./types.js";

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
	const mainAccount = data.riotAccounts.find((account) => account.isMain);
	const mainPositionLabel = mainAccount?.mainPosition
		? (ROLE_LABEL[mainAccount.mainPosition] ?? mainAccount.mainPosition)
		: null;
	const bestLane = data.laneMmrs
		.filter((lane) => lane.mmr != null)
		.sort((a, b) => (b.mmr ?? 0) - (a.mmr ?? 0))[0];

	return (
		<div className="surface-base rounded-lg border border-base-300 p-3 sm:p-4">
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
					<div className="min-w-0 flex-1">
						<h1 className="text-2xl font-bold flex items-center gap-2 min-w-0">
							<span className="truncate">{data.user.displayName}</span>
							{isMe && <StatusBadge tone="primary">YOU</StatusBadge>}
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
						<div className="flex flex-wrap items-center gap-1.5 mt-2">
							<StatusBadge tone={mainPositionLabel ? "info" : "neutral"} variant="soft" size="sm">
								주력 라인 {mainPositionLabel ?? "미계산"}
							</StatusBadge>
							{bestLane && (
								<StatusBadge tone="success" variant="soft" size="sm">
									최고 MMR {ROLE_LABEL[bestLane.role] ?? bestLane.role} {bestLane.mmr}
								</StatusBadge>
							)}
							{mainAccount?.mainPositionUpdatedAt && (
								<span className="text-xs text-base-content/40">
									{formatUpdatedAt(mainAccount.mainPositionUpdatedAt)}
								</span>
							)}
						</div>
					</div>
				</div>
				<button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
					← 돌아가기
				</button>
			</div>

			<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
				<ProfileMetric label="게임" value={`${data.totals.games}G`} />
				<ProfileMetric label="승패" value={`${data.totals.wins}-${data.totals.losses}`} />
				<ProfileMetric
					label="승률"
					value={data.totals.games > 0 ? `${totalWrPct}%` : "0%"}
					{...(data.totals.games > 0 ? { valueClassName: winrateToneClass(totalWrPct) } : {})}
				/>
				<ProfileMetric label="Riot 계정" value={`${data.riotAccounts.length}`} />
			</div>

			<div className="flex flex-wrap gap-1.5 mt-3 items-center">
				{data.riotAccounts.map((account) => (
					<StatusBadge
						key={`${account.gameName}#${account.tagLine}`}
						tone={account.isMain ? "warning" : "neutral"}
						variant={account.isMain ? "soft" : "ghost"}
					>
						{account.isMain && "⭐ "}
						{account.gameName}#{account.tagLine}
					</StatusBadge>
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
	);
}

function ProfileMetric({
	label,
	value,
	valueClassName,
}: {
	label: string;
	value: string;
	valueClassName?: string;
}) {
	return (
		<div className="rounded-md border border-base-300 bg-base-100/70 px-3 py-2 min-w-0">
			<div className="text-[10px] uppercase tracking-wide text-base-content/50">{label}</div>
			<div className={cx("text-lg font-bold tabular-nums truncate", valueClassName)}>{value}</div>
		</div>
	);
}

function formatUpdatedAt(epochSec: number): string {
	const date = new Date(epochSec * 1000);
	return `갱신 ${date.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}`;
}
