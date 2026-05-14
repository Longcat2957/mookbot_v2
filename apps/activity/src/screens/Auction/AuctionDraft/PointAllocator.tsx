import { useState } from "react";
import { UserAvatar } from "../../../components/UserAvatar.js";
import type { AuctionTeam } from "../types.js";

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
			const changed = teams
				.filter((t) => points[t.id] !== t.initialPoints)
				.map((t) => ({ teamId: t.id, initialPoints: points[t.id]! }));
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
						const pct = baseline > 0 ? Math.round((p / 1000) * 50) : 50; // 1000p = 50% (중앙). 2000p = 100%
						return (
							<div key={t.id} className="card bg-base-100">
								<div className="card-body p-4 gap-2.5">
									<div className="flex items-center gap-3">
										<div
											className="radial-progress text-warning tabular-nums"
											style={{ "--value": pct, "--size": "4rem", "--thickness": "5px" } as React.CSSProperties}
											aria-valuenow={pct}
											role="progressbar"
										>
											<span className="text-sm font-bold">{p}p</span>
										</div>
										<UserAvatar
											discordId={t.captainUserId}
											displayName={t.captainName}
											imageUrl={t.captainProfileIconUrl}
											size="sm"
										/>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-1.5">
												<div className="badge badge-info badge-lg">팀{t.teamIndex}</div>
												<span className="badge badge-warning badge-sm">👑</span>
											</div>
											<div className="font-bold text-base truncate">{t.captainName}</div>
										</div>
									</div>
									<input
										type="number"
										value={p}
										onChange={(e) => setPoints((prev) => ({ ...prev, [t.id]: Number(e.target.value) }))}
										disabled={!canEdit}
										min={0}
										step={50}
										className="input input-bordered w-full text-right tabular-nums text-lg font-bold"
									/>
								</div>
							</div>
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
