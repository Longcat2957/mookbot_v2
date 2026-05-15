// 경매내전 BIDDING 매물 정보 — 라이엇 연동 + 내전 기록 두 섹션.
// 데이터 fetch 는 부모 (BiddingPanel) 에서. 이 파일은 섹션 조립 전담.

import { CandidateMookDetails } from "./CandidateMookDetails.js";
import { CandidateRiotDetails } from "./CandidateRiotDetails.js";
import type { AuctionCardData } from "./candidateInfoTypes.js";

export type { AuctionCardData } from "./candidateInfoTypes.js";

export function CandidateRiotSection({
	data,
	error,
}: {
	data: AuctionCardData | null;
	error: string | null;
}) {
	if (error) {
		return <div className="alert alert-warning text-sm">라이엇 정보 로딩 실패 — {error}</div>;
	}
	if (!data) {
		return (
			<div className="flex items-center gap-2 text-base-content/60 text-sm">
				<span className="loading loading-spinner loading-sm" />
				라이엇 정보 로딩 중…
			</div>
		);
	}

	const bestAccount = data.riotAccounts[0];
	if (!bestAccount) {
		return <div className="text-sm text-base-content/50">연동된 라이엇 계정 없음</div>;
	}

	return <CandidateRiotDetails account={bestAccount} />;
}

export function CandidateMookSection({ data }: { data: AuctionCardData | null }) {
	if (!data) {
		return null;
	}

	return <CandidateMookDetails data={data} />;
}
