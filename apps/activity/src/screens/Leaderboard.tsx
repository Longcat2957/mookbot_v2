// 리더보드 — 라인 5탭 + 통합 (가중평균 MMR) 탭.
// games_played ≥ 1 사용자만. 본인 row 하이라이트. 행 클릭 → Profile.
//
// WS 토픽 구독: leaderboard:<role> (게임 결과 입력 시 자동 갱신).

import { useCallback, useEffect, useState } from "react";
import { api } from "../api/rest.js";
import { wsClient } from "../api/ws.js";
import { EmptyState } from "../components/EmptyState.js";
import { showToast } from "../components/Toaster.js";
import { usePerms } from "../state/perms.js";
import { useStaleWhileRevalidate } from "../state/useStaleWhileRevalidate.js";

type Tab = "TOP" | "JUNGLE" | "MID" | "BOTTOM" | "SUPPORT" | "COMPOSITE";

const TABS: { key: Tab; label: string }[] = [
	{ key: "TOP", label: "탑" },
	{ key: "JUNGLE", label: "정글" },
	{ key: "MID", label: "미드" },
	{ key: "BOTTOM", label: "원딜" },
	{ key: "SUPPORT", label: "서폿" },
	{ key: "COMPOSITE", label: "통합" },
];

interface LeaderRow {
	rank: number;
	userId: string;
	displayName: string;
	mmr: number;
	games: number;
	wins: number;
	losses: number;
	winrate: number;
	rolesPlayed?: number; // 통합만
}

interface LeaderboardResponse {
	role: string;
	seasonId: number;
	rows: LeaderRow[];
}

export function Leaderboard({
	onBack,
	onSelectUser,
}: {
	onBack: () => void;
	onSelectUser: (userId: string) => void;
}) {
	const [tab, setTab] = useState<Tab>("TOP");
	const perms = usePerms();

	const fetcher = useCallback(() => {
		const url =
			tab === "COMPOSITE" ? "/leaderboard/composite?limit=50" : `/leaderboard?role=${tab}&limit=50`;
		return api<LeaderboardResponse>(url);
	}, [tab]);

	const swr = useStaleWhileRevalidate<LeaderboardResponse>(`leaderboard:${tab}`, fetcher, {
		debounceMs: 150,
	});

	// WS 토픽 구독
	useEffect(() => {
		return wsClient.subscribe(`leaderboard:${tab}`, () => {
			swr.refresh();
			showToast("리더보드가 업데이트되었습니다");
		});
	}, [tab, swr]);

	const data = swr.data;
	const error = swr.error;

	return (
		<section className="space-y-4">
			<div className="flex items-start justify-between gap-3 flex-wrap">
				<div>
					<h1 className="text-2xl font-bold">🏆 리더보드</h1>
					<p className="text-sm text-base-content/70">
						{tab === "COMPOSITE"
							? "라인 가중평균 MMR — Σ(MMR × 게임수) ÷ Σ(게임수)"
							: `${TABS.find((t) => t.key === tab)?.label} 라인 시즌 MMR 랭킹`}
						{data ? ` · 시즌 ${data.seasonId}` : ""}
					</p>
				</div>
				<button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
					← 대시보드
				</button>
			</div>

			<div role="tablist" className="tabs tabs-bordered overflow-x-auto">
				{TABS.map((t) => (
					<button
						key={t.key}
						type="button"
						role="tab"
						aria-selected={tab === t.key}
						className={`tab whitespace-nowrap ${tab === t.key ? "tab-active" : ""}`}
						onClick={() => setTab(t.key)}
					>
						{t.label}
					</button>
				))}
			</div>

			{error ? (
				<div className="alert alert-error">
					<span>리더보드를 불러오지 못했습니다: {error}</span>
				</div>
			) : !data ? (
				<TableSkeleton />
			) : data.rows.length === 0 ? (
				<EmptyState
					title="아직 기록이 없습니다"
					description="이번 시즌의 게임 기록이 쌓이면 여기에 표시됩니다."
					tone="info"
				/>
			) : (
				<LeaderTable rows={data.rows} myUserId={perms.discordId} onSelectUser={onSelectUser} />
			)}
		</section>
	);
}

function LeaderTable({
	rows,
	myUserId,
	onSelectUser,
}: {
	rows: LeaderRow[];
	myUserId: string;
	onSelectUser: (userId: string) => void;
}) {
	return (
		<div className="overflow-x-auto rounded-lg border border-base-300">
			<table className="table table-sm tabular-nums">
				<thead className="bg-base-200">
					<tr>
						<th className="w-10 text-center">#</th>
						<th>닉네임</th>
						<th className="text-right">MMR</th>
						<th className="text-right">G</th>
						<th className="text-right">W-L</th>
						<th className="text-right">승률</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((r) => {
						const isMe = r.userId === myUserId;
						const medal = r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : `${r.rank}`;
						const wrPct = Math.round(r.winrate * 100);
						return (
							<tr
								key={r.userId}
								className={`cursor-pointer transition ${
									isMe ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-base-200/60"
								}`}
								onClick={() => onSelectUser(r.userId)}
							>
								<td className="text-center font-bold">{medal}</td>
								<td className="font-medium">
									{r.displayName}
									{isMe && <span className="ml-2 badge badge-primary badge-xs align-middle">YOU</span>}
									{r.rolesPlayed !== undefined && (
										<span className="ml-2 text-xs text-base-content/50">({r.rolesPlayed}라인)</span>
									)}
								</td>
								<td className="text-right font-bold">{r.mmr}</td>
								<td className="text-right text-base-content/70">{r.games}</td>
								<td className="text-right text-base-content/70">
									<span className="text-info">{r.wins}</span>-<span className="text-error">{r.losses}</span>
								</td>
								<td
									className={`text-right font-medium ${
										wrPct >= 60
											? "text-success"
											: wrPct >= 50
												? "text-info"
												: wrPct >= 40
													? "text-base-content/70"
													: "text-error"
									}`}
								>
									{wrPct}%
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

function TableSkeleton() {
	return (
		<div className="rounded-lg border border-base-300 overflow-hidden">
			{[0, 1, 2, 3, 4].map((i) => (
				<div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-base-300">
					<div className="skeleton h-5 w-5" />
					<div className="skeleton h-5 flex-1 max-w-32" />
					<div className="skeleton h-5 w-16" />
				</div>
			))}
		</div>
	);
}
