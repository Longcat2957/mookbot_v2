// 경매내전 입찰 의도 (transient) — 운영자가 입력 중인 가격을 다른 화면에 실시간 공유.
//
// 영속화 X — BIDDING 단계는 짧고, 서버 재시작 시 손실되어도 운영자가 다시 입력하면 됨.
// finalize-bid / manual-assign / cancel-draw / status 전환 / draw(새 매물) 시 모두 clear.
//
// 메모리 사용 — 동시에 진행되는 토너먼트는 1~2 개 수준 + 팀당 최대 4 개 → 작음.

interface BidIntent {
	points: number;
	updatedAt: number;
}

// tournamentId → (teamId → intent)
const store = new Map<number, Map<number, BidIntent>>();

export function getBidIntents(tournamentId: number): Array<{ teamId: number; points: number }> {
	const inner = store.get(tournamentId);
	if (!inner) return [];
	const out: Array<{ teamId: number; points: number }> = [];
	for (const [teamId, intent] of inner) {
		out.push({ teamId, points: intent.points });
	}
	// 안정적 정렬 — 클라이언트가 매번 같은 순서로 보이도록
	out.sort((a, b) => a.teamId - b.teamId);
	return out;
}

export function setBidIntent(tournamentId: number, teamId: number, points: number | null): void {
	if (points === null) {
		const inner = store.get(tournamentId);
		if (!inner) return;
		inner.delete(teamId);
		if (inner.size === 0) store.delete(tournamentId);
		return;
	}
	let inner = store.get(tournamentId);
	if (!inner) {
		inner = new Map();
		store.set(tournamentId, inner);
	}
	inner.set(teamId, { points, updatedAt: Date.now() });
}

export function clearBidIntents(tournamentId: number): void {
	store.delete(tournamentId);
}

// 테스트 / 디버깅용 — 모든 store reset
export function _resetAllBidIntents(): void {
	store.clear();
}
