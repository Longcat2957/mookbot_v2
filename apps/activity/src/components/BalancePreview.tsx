// 밸런스 미리보기 — PickBan 화면이 Game 1 사이드 결정 후 노출.
//
// 라인별 매치업 카드 (1팀 좌 / 2팀 우) + 평균 MMR + 차이.
// 각 플레이어 행은 nested collapse — 펼치면 "내전 챔프 Top 5" 가 노출됨.
// "전체 열기" 토글로 한 번에 펼치기/닫기.
//
// SVG 엔드포인트 (/balance.svg) 는 미래 Discord webhook 업로드 용으로 서버에 보존.
// 클라이언트는 props 로 받은 데이터만 렌더 — 별도 fetch 없음.

import { useMemo, useState } from "react";
import { winrateBadgeClass as wrColorClass } from "../state/winrateColor.js";

type Side = "BLUE" | "RED";
type Team = "TEAM_1" | "TEAM_2";

interface ChampionPlay {
	championId: number;
	championName: string;
	iconUrl: string;
	plays: number;
	wins: number;
	losses: number;
}

interface PlayHistory {
	total: { plays: number; wins: number; losses: number };
	topChampions: ChampionPlay[];
	topChampionsByRole: Record<string, ChampionPlay[]>;
	rolePlays: { role: string; plays: number; wins: number; losses: number }[];
	topRole: { role: string; plays: number; wins: number; losses: number } | null;
}

interface Participant {
	userId: string;
	displayName: string;
	team: Team;
	role: string;
	laneMmr: number;
	history: PlayHistory;
}

interface Props {
	team1Side: Side;
	participants: Participant[];
}

const LANE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;
const LANE_LABEL: Record<string, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};

export function BalancePreview({ team1Side, participants }: Props) {
	const team2Side: Side = team1Side === "BLUE" ? "RED" : "BLUE";
	const t1ColorText = team1Side === "BLUE" ? "text-info" : "text-error";
	const t2ColorText = team2Side === "BLUE" ? "text-info" : "text-error";
	const t1Border = team1Side === "BLUE" ? "border-info" : "border-error";
	const t2Border = team2Side === "BLUE" ? "border-info" : "border-error";
	const t1Badge = team1Side === "BLUE" ? "badge-info" : "badge-error";
	const t2Badge = team2Side === "BLUE" ? "badge-info" : "badge-error";

	const { byTeamLane, activeLanes, t1Avg, t2Avg } = useMemo(() => {
		const map = new Map<string, Participant>();
		for (const p of participants) map.set(`${p.team}_${p.role}`, p);
		const lanes = LANE_ORDER.filter((l) => map.has(`TEAM_1_${l}`) && map.has(`TEAM_2_${l}`));
		const t1Sum = lanes.reduce((acc, l) => acc + (map.get(`TEAM_1_${l}`)?.laneMmr ?? 0), 0);
		const t2Sum = lanes.reduce((acc, l) => acc + (map.get(`TEAM_2_${l}`)?.laneMmr ?? 0), 0);
		const size = Math.max(1, lanes.length);
		return {
			byTeamLane: map,
			activeLanes: lanes,
			t1Avg: Math.round(t1Sum / size),
			t2Avg: Math.round(t2Sum / size),
		};
	}, [participants]);

	// 펼친 플레이어 키 ("TEAM_1_TOP" 등) 의 set. 행을 직접 클릭하거나
	// 헤더의 "전체 열기" 로 전체 토글.
	const allKeys = useMemo(
		() => activeLanes.flatMap((l) => [`TEAM_1_${l}`, `TEAM_2_${l}`]),
		[activeLanes],
	);
	const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());
	const anyOpen = openKeys.size > 0;
	const toggleAll = () => {
		setOpenKeys(anyOpen ? new Set() : new Set(allKeys));
	};
	const toggleOne = (key: string, open: boolean) => {
		setOpenKeys((prev) => {
			const next = new Set(prev);
			if (open) next.add(key);
			else next.delete(key);
			return next;
		});
	};

	return (
		<details className="collapse collapse-arrow bg-base-200 shadow-sm" open>
			<summary className="collapse-title text-sm font-medium py-2 min-h-0 px-3">
				🎯 밸런스 미리보기 (Game 1 · 1팀 {team1Side})
			</summary>
			<div className="collapse-content px-3 pb-3 space-y-3">
				{/* Team header pills */}
				<div className="grid grid-cols-2 gap-2">
					<div className={`badge ${t1Badge} w-full justify-center font-bold py-3`}>
						1팀 · {team1Side}
					</div>
					<div className={`badge ${t2Badge} w-full justify-center font-bold py-3`}>
						2팀 · {team2Side}
					</div>
				</div>

				{/* Per-lane matchup rows */}
				<div className="space-y-1.5">
					{activeLanes.map((lane) => {
						const t1 = byTeamLane.get(`TEAM_1_${lane}`);
						const t2 = byTeamLane.get(`TEAM_2_${lane}`);
						if (!t1 || !t2) return null;
						return (
							<div key={lane} className="grid grid-cols-2 gap-2 items-start">
								<PlayerRow
									player={t1}
									lane={lane}
									borderColor={t1Border}
									nameAlign="left"
									isOpen={openKeys.has(`TEAM_1_${lane}`)}
									onToggle={(open) => toggleOne(`TEAM_1_${lane}`, open)}
								/>
								<PlayerRow
									player={t2}
									lane={lane}
									borderColor={t2Border}
									nameAlign="left"
									isOpen={openKeys.has(`TEAM_2_${lane}`)}
									onToggle={(open) => toggleOne(`TEAM_2_${lane}`, open)}
								/>
							</div>
						);
					})}
				</div>

				{/* Summary — avg MMR */}
				<div className="grid grid-cols-2 gap-2 pt-2 border-t border-base-300">
					<div className={`text-center text-sm ${t1ColorText}`}>
						평균 <span className="font-bold tabular-nums">{t1Avg}</span>
					</div>
					<div className={`text-center text-sm ${t2ColorText}`}>
						평균 <span className="font-bold tabular-nums">{t2Avg}</span>
					</div>
				</div>

				{/* 전체 열기/닫기 */}
				<div className="flex justify-center">
					<button type="button" className="btn btn-xs btn-ghost" onClick={toggleAll}>
						{anyOpen ? "전체 닫기" : "전체 열기"}
					</button>
				</div>
			</div>
		</details>
	);
}

function PlayerRow({
	player,
	lane,
	borderColor,
	nameAlign,
	isOpen,
	onToggle,
}: {
	player: Participant;
	lane: string;
	borderColor: string;
	nameAlign: "left" | "right";
	isOpen: boolean;
	onToggle: (open: boolean) => void;
}) {
	// 해당 플레이어가 그 라인으로 플레이했을 때의 챔프만. 라인 무관 overall 은 사용 X.
	const top5 = (player.history.topChampionsByRole[player.role] ?? []).slice(0, 5);
	const alignClass = nameAlign === "right" ? "text-right" : "text-left";

	return (
		<details
			className={`collapse collapse-arrow bg-base-100 border-l-4 ${borderColor}`}
			open={isOpen}
			onToggle={(e) => onToggle(e.currentTarget.open)}
		>
			<summary className="collapse-title min-h-0 py-1.5 px-2.5 text-sm">
				{/* pr-8: daisyUI collapse-arrow 가 우측 ~24px 영역 차지 — MMR 와 겹침 방지 */}
				<div className="flex items-center justify-between gap-1.5 pr-8">
					<div className="flex items-center gap-1.5 min-w-0">
						<span className="badge badge-xs badge-ghost shrink-0">{LANE_LABEL[lane] ?? lane}</span>
						<span className={`font-semibold truncate ${alignClass}`}>{player.displayName}</span>
					</div>
					<span className="tabular-nums text-xs text-base-content/60 shrink-0">{player.laneMmr}</span>
				</div>
			</summary>
			<div className="collapse-content px-2.5 pb-2.5">
				<div className="text-[10px] uppercase tracking-wide text-base-content/50 mb-1">
					{LANE_LABEL[lane] ?? lane} 라인 내전 챔프 Top 5
				</div>
				{top5.length === 0 ? (
					<div className="text-xs italic text-base-content/40 py-2">이 라인 내전 기록 없음</div>
				) : (
					<ul className="space-y-1">
						{top5.map((c) => {
							const wr = c.plays > 0 ? Math.round((c.wins / c.plays) * 100) : 0;
							return (
								<li key={c.championId} className="flex items-center gap-1.5 text-xs">
									{c.iconUrl && (
										<img src={c.iconUrl} alt="" className="size-5 rounded shrink-0" loading="lazy" />
									)}
									<span className="flex-1 truncate">{c.championName}</span>
									<span className="tabular-nums text-base-content/60 shrink-0">
										{c.wins}승 {c.losses}패
									</span>
									<span className={`badge badge-xs ${wrColorClass(wr)} shrink-0`}>{wr}%</span>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</details>
	);
}
