import { ChampCell } from "../ChampCell.js";
import type { Champion, PickUsage } from "../types.js";

export function BlockedChampionGrid({
	blocked,
	previousPicks,
}: {
	blocked: { champ: Champion; reason: "used" | "fearless" }[];
	previousPicks?: Map<number, PickUsage[]> | undefined;
}) {
	if (blocked.length === 0) return null;

	return (
		<details className="surface-quiet-soft rounded-md">
			<summary className="cursor-pointer text-xs font-medium px-3 py-2 text-base-content/70">
				사용 불가 ({blocked.length}) — 이번 게임 사용 또는 Hard Fearless
			</summary>
			<div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-1.5 p-3 pt-0">
				{blocked.map(({ champ, reason }) => (
					<ChampCell
						key={champ.id}
						champ={champ}
						disabled
						blocked={reason}
						reason={
							reason === "fearless"
								? `${champ.name} — 이전 게임에서 사용 (Hard Fearless)`
								: `${champ.name} — 이번 게임에서 이미 사용`
						}
						previousUsage={previousPicks?.get(champ.id)}
					/>
				))}
			</div>
		</details>
	);
}
