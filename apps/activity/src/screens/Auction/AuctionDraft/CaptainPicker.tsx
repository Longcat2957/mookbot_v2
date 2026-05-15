import { useEffect, useState } from "react";
import { api } from "../../../api/rest.js";
import type { AuctionRecruitmentDetail } from "../types.js";
import { CaptainCandidateButton } from "./CaptainCandidateButton.js";

// ============================================================
// CAPTAIN_PICK — 4명 (20인) 또는 2명 (10인) 선출
// ============================================================
export function CaptainPicker({
	tournamentId,
	format,
	canEdit,
	onSet,
}: {
	tournamentId: number;
	format: 10 | 20;
	canEdit: boolean;
	onSet: (userIds: string[]) => Promise<void>;
}) {
	const [recruit, setRecruit] = useState<AuctionRecruitmentDetail | null>(null);
	const [selected, setSelected] = useState<string[]>([]);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const expected = format === 20 ? 4 : 2;

	useEffect(() => {
		(async () => {
			try {
				const d = await api<AuctionRecruitmentDetail>(`/auction-recruitments/${tournamentId}`);
				setRecruit(d);
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			}
		})();
	}, [tournamentId]);

	const toggle = (uid: string) => {
		setSelected((prev) => {
			if (prev.includes(uid)) return prev.filter((u) => u !== uid);
			if (prev.length >= expected) return prev;
			return [...prev, uid];
		});
	};

	const submit = async () => {
		if (selected.length !== expected) return;
		setSubmitting(true);
		setError(null);
		try {
			await onSet(selected);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	if (!recruit) return <div className="alert alert-info">참가자 로딩 중…</div>;

	const remaining = expected - selected.length;

	return (
		<div className="card surface-base shadow">
			<div className="card-body p-5 gap-4">
				<div className="flex items-center justify-between flex-wrap gap-3">
					<div>
						<h3 className="text-lg font-bold">팀장 선출</h3>
						<p className="text-base text-base-content/60">참가자 중에서 팀장이 될 사람을 클릭하세요.</p>
					</div>
					<div className="stats shadow bg-base-100">
						<div className="stat py-2 px-4">
							<div className="stat-title text-sm">선택</div>
							<div className="stat-value text-3xl text-primary tabular-nums">{selected.length}</div>
							<div className="stat-desc text-sm tabular-nums">
								/ {expected} {remaining > 0 ? `(${remaining}명 더)` : "(완료)"}
							</div>
						</div>
					</div>
				</div>
				<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
					{recruit.participants.map((p) => {
						const isSelected = selected.includes(p.userId);
						return (
							<CaptainCandidateButton
								key={p.userId}
								participant={p}
								selected={isSelected}
								canEdit={canEdit}
								onToggle={() => toggle(p.userId)}
							/>
						);
					})}
				</div>
				{error && <div className="alert alert-error">{error}</div>}
				{canEdit && (
					<button
						type="button"
						className="btn btn-primary btn-lg"
						onClick={submit}
						disabled={selected.length !== expected || submitting}
					>
						{submitting ? "진행 중…" : `▶ 팀장 확정 (${selected.length}/${expected})`}
					</button>
				)}
			</div>
		</div>
	);
}
