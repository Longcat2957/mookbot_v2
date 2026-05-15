import { AuctionSteps } from "../AuctionSteps.js";
import type { AuctionRecruitmentDetail } from "../types.js";

export function RecruitmentStartPanel({
	recruitDetail,
	error,
	canEdit,
	creating,
	onEnterTournament,
}: {
	recruitDetail: AuctionRecruitmentDetail;
	error: string | null;
	canEdit: boolean;
	creating: boolean;
	onEnterTournament: () => void;
}) {
	return (
		<section className="space-y-4">
			<header className="space-y-3">
				<h2 className="text-2xl font-bold">🎟️ 경매내전 모집 #{recruitDetail.recruitment.id}</h2>
				<p className="text-base text-base-content/70">
					{recruitDetail.recruitment.targetCount}인 · 참가자{" "}
					<span className="font-bold tabular-nums">
						{recruitDetail.participants.length}/{recruitDetail.recruitment.targetCount}
					</span>
				</p>
				<AuctionSteps status="RECRUITMENT" />
			</header>
			<div className="card surface-base">
				<div className="card-body p-5 gap-2">
					<h3 className="text-base font-bold">참가자</h3>
					{recruitDetail.participants.map((p, i) => (
						<div key={p.userId} className="text-base">
							<span className="text-base-content/50 tabular-nums">{i + 1}.</span>{" "}
							<strong>{p.displayName}</strong>
						</div>
					))}
				</div>
			</div>
			{error && <div className="alert alert-error">{error}</div>}
			{canEdit && (
				<button
					type="button"
					className="btn btn-primary btn-lg"
					onClick={onEnterTournament}
					disabled={
						creating || recruitDetail.participants.length !== recruitDetail.recruitment.targetCount
					}
				>
					{creating ? "진입 중…" : "▶ 경매 시작"}
				</button>
			)}
		</section>
	);
}
