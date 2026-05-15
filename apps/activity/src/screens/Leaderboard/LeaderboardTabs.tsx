import { LEADERBOARD_TABS, type LeaderboardTab } from "./types.js";

interface Props {
	activeTab: LeaderboardTab;
	onChange: (tab: LeaderboardTab) => void;
}

export function LeaderboardTabs({ activeTab, onChange }: Props) {
	return (
		<div role="tablist" className="tabs tabs-bordered overflow-x-auto">
			{LEADERBOARD_TABS.map((tab) => (
				<button
					key={tab.key}
					type="button"
					role="tab"
					aria-selected={activeTab === tab.key}
					className={`tab whitespace-nowrap ${activeTab === tab.key ? "tab-active" : ""}`}
					onClick={() => onChange(tab.key)}
				>
					{tab.label}
				</button>
			))}
		</div>
	);
}
