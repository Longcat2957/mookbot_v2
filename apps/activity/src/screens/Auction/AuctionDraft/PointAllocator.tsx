import { useState } from "react";
import type { AuctionTeam } from "../types.js";
import { PointAllocatorTeamCard } from "./PointAllocatorTeamCard.js";

// ============================================================
// POINT_ALLOC — 팀별 초기 포인트 (기본 1000, 조정 가능)
// ============================================================
export function PointAllocator({
	teams,
	canEdit,
	onSet,
	onStartBidding,
}: {
	teams: AuctionTeam[];
	canEdit: boolean;
	onSet: (points: Array<{ teamId: number; initialPoints: number }>) => Promise<void>;
	onStartBidding: () => Promise<void>;
}) {
	const [points, setPoints] = useState<Record<number, number>>(() =>
		Object.fromEntries(teams.map((t) => [t.id, t.initialPoints])),
	);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const startBidding = async () => {
		setSubmitting(true);
		setError(null);
		try {
			// 변경된 팀만 저장 → start-bidding 전이
			const changed = teams.flatMap((t) => {
				const initialPoints = points[t.id] ?? t.initialPoints;
				return initialPoints === t.initialPoints ? [] : [{ teamId: t.id, initialPoints }];
			});
			if (changed.length > 0) await onSet(changed);
			await onStartBidding();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	const total = teams.reduce((acc, t) => acc + (points[t.id] ?? 0), 0);
	const baseline = teams.length * 1000; // 기준값 (4팀 = 4000)

	return (
		<div className="card surface-base shadow">
			<div className="card-body p-5 gap-4">
				<div className="flex items-center justify-between flex-wrap gap-3">
					<div>
						<h3 className="text-lg font-bold">팀장별 초기 포인트</h3>
						<p className="text-base text-base-content/60">
							기본 1000 — 실력 격차 핸디캡으로 조정 (잘하는 팀장 ↓, 못하는 팀장 ↑).
						</p>
					</div>
					<div className="stats shadow bg-base-100">
						<div className="stat py-2 px-4">
							<div className="stat-title text-sm">총 분배</div>
							<div
								className={`stat-value text-3xl tabular-nums ${total === baseline ? "text-success" : "text-warning"}`}
							>
								{total}
							</div>
							<div className="stat-desc text-sm tabular-nums">
								기준 {baseline}
								{total !== baseline && (
									<span className="ml-1 text-warning">
										({total > baseline ? "+" : ""}
										{total - baseline})
									</span>
								)}
							</div>
						</div>
					</div>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					{teams.map((t) => {
						const p = points[t.id] ?? 0;
						return (
							<PointAllocatorTeamCard
								key={t.id}
								team={t}
								points={p}
								canEdit={canEdit}
								onChange={(next) => setPoints((prev) => ({ ...prev, [t.id]: next }))}
							/>
						);
					})}
				</div>
				{error && <div className="alert alert-error">{error}</div>}
				{canEdit && (
					<button
						type="button"
						className="btn btn-primary btn-lg"
						onClick={startBidding}
						disabled={submitting}
					>
						{submitting ? "진행 중…" : "▶ 경매 시작"}
					</button>
				)}
			</div>
		</div>
	);
}
