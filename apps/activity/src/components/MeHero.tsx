import { InteractivePanelCard } from "./DesignPrimitives.js";
import { LaneMmrGrid } from "./MeHero/LaneMmrGrid.js";
import { MeIdentity } from "./MeHero/MeIdentity.js";
import { SeasonSummary } from "./MeHero/SeasonSummary.js";
import { ROLE_ORDER } from "./MeHero/types.js";
import { useMeProfile } from "./MeHero/useMeProfile.js";

export function MeHero({ onSelectMe }: { onSelectMe: () => void }) {
	const { userId, data, error } = useMeProfile();

	if (!userId) return null;
	if (error) return null;
	if (!data) {
		return <div className="skeleton h-36 w-full rounded-box" />;
	}

	const { user, riotAccounts, season, totals, laneMmrs, topChampions } = data;
	const mainRiot = riotAccounts.find((a) => a.isMain);
	const sortedMmrs = [...laneMmrs].sort(
		(a, b) =>
			ROLE_ORDER.indexOf(a.role as (typeof ROLE_ORDER)[number]) -
			ROLE_ORDER.indexOf(b.role as (typeof ROLE_ORDER)[number]),
	);

	return (
		<InteractivePanelCard
			onClick={onSelectMe}
			status="primary"
			className="bg-gradient-to-br from-base-200 to-base-200/60 border border-base-300 hover:border-primary/40 hover:shadow-md w-full"
			bodyClassName="p-4 sm:p-5 gap-3"
			aria-label="내 프로필 열기"
		>
			<div className="flex items-start justify-between gap-3 flex-wrap">
				<MeIdentity user={user} mainRiot={mainRiot} topChampion={topChampions[0]} />
				<SeasonSummary season={season} totals={totals} />
			</div>

			<LaneMmrGrid laneMmrs={sortedMmrs} />
			<div className="text-xs text-base-content/50 text-right">자세히 →</div>
		</InteractivePanelCard>
	);
}
