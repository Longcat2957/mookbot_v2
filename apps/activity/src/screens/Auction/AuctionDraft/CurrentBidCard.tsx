import { UserAvatar } from "../../../components/UserAvatar.js";
import {
	type AuctionCardData,
	CandidateMookSection,
	CandidateRiotSection,
} from "../CandidateInfo.js";
import type { AuctionTournamentDetail } from "../types.js";

type CurrentBidTarget = AuctionTournamentDetail["tournament"]["currentBidTarget"];

export function CurrentBidCard({
	currentBidTarget,
	canEdit,
	allPlaced,
	submitting,
	candidateData,
	candidateError,
	candidateRiotIcon,
	onDraw,
	onCancelDraw,
}: {
	currentBidTarget: CurrentBidTarget;
	canEdit: boolean;
	allPlaced: boolean;
	submitting: boolean;
	candidateData: AuctionCardData | null;
	candidateError: string | null;
	candidateRiotIcon: string | null;
	onDraw: () => void;
	onCancelDraw: () => void;
}) {
	return (
		<div className="card surface-base border-l-4 border-primary shadow">
			<div className="card-body p-4 gap-3">
				<div className="flex items-center justify-between flex-wrap gap-2">
					<h3 className="text-base font-bold flex items-center gap-2">
						📦 현재 매물
						{currentBidTarget && (
							<span className="inline-block size-2.5 rounded-full bg-success animate-pulse" aria-hidden />
						)}
					</h3>
					<div className="flex items-center gap-2">
						{currentBidTarget && canEdit && (
							<button
								type="button"
								className="btn btn-ghost btn-sm"
								onClick={onCancelDraw}
								disabled={submitting}
								title="매물 취소 — 배치 없이 닫고 다음으로"
							>
								유찰 / 다음으로
							</button>
						)}
						{canEdit && (
							<button
								type="button"
								className="btn btn-primary btn-sm"
								onClick={onDraw}
								disabled={allPlaced || currentBidTarget !== null}
								title={
									allPlaced
										? "모든 인원 배치 완료"
										: currentBidTarget
											? "현재 매물 처리 후"
											: "랜덤 1명 추출"
								}
							>
								🎲 다음 인원
							</button>
						)}
					</div>
				</div>
				{currentBidTarget ? (
					<CurrentCandidate
						currentBidTarget={currentBidTarget}
						candidateData={candidateData}
						candidateError={candidateError}
						candidateRiotIcon={candidateRiotIcon}
					/>
				) : allPlaced ? (
					<div className="text-lg text-success font-medium">
						✅ 모두 배치 완료 — 아래 [▶ 토너먼트 진행] 클릭하세요.
					</div>
				) : (
					<div className="text-base text-base-content/60">
						🎲 버튼으로 다음 인원 추출 (다른 화면 함께 sync)
					</div>
				)}
			</div>
		</div>
	);
}

function CurrentCandidate({
	currentBidTarget,
	candidateData,
	candidateError,
	candidateRiotIcon,
}: {
	currentBidTarget: NonNullable<CurrentBidTarget>;
	candidateData: AuctionCardData | null;
	candidateError: string | null;
	candidateRiotIcon: string | null;
}) {
	return (
		<>
			<div className="flex items-center gap-3 py-1">
				<UserAvatar
					discordId={currentBidTarget.userId}
					displayName={currentBidTarget.displayName}
					size="lg"
					imageUrl={candidateRiotIcon ?? currentBidTarget.profileIconUrl}
				/>
				<div className="flex-1 min-w-0">
					<div className="text-2xl font-bold truncate">{currentBidTarget.displayName}</div>
					<div className="text-sm text-base-content/60">매물 진행 중 · 보이스에서 입찰 협의</div>
				</div>
			</div>

			<div className="grid grid-cols-1 2xl:grid-cols-2 gap-3">
				<section className="space-y-2 min-w-0">
					<div className="text-xs font-bold text-base-content/60">🎮 라이엇 연동</div>
					<CandidateRiotSection
						key={`riot-${currentBidTarget.userId}`}
						data={candidateData}
						error={candidateError}
					/>
				</section>
				<section className="space-y-2 min-w-0">
					<div className="text-xs font-bold text-base-content/60">⚔️ 내전 기록</div>
					<CandidateMookSection key={`mook-${currentBidTarget.userId}`} data={candidateData} />
				</section>
			</div>
		</>
	);
}
