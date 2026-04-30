// ============================================================
// Discord 별명에서 라이엇 ID 추출
// ============================================================
// 운영 컨벤션: `이름(롤아이디)` 또는 `이름(롤아이디#태그)`
//
// 추출 규칙:
//   - 별명 전체에 `#` 가 2개 이상 → null (모호 — 호출 측에서 별도 처리)
//   - `(...)` 안에 `#` 1개:    GameName / TagLine 분리
//   - `(...)` 안에 `#` 없음:   gameName=내부, tagLine="KR1" (디폴트)
//   - `(...)` 자체가 없음:     null
// ============================================================

export interface ExtractedRiotId {
	gameName: string;
	tagLine: string;
	tagExplicit: boolean;
}

const DEFAULT_TAG_LINE = "KR1";

export function countHashes(s: string): number {
	return (s.match(/#/g) ?? []).length;
}

export function extractRiotIdFromDisplayName(displayName: string): ExtractedRiotId | undefined {
	if (countHashes(displayName) > 1) return undefined;

	const match = displayName.match(/\(([^)]+)\)\s*$/);
	if (!match) return undefined;

	const inner = match[1]!.trim();
	if (inner.length === 0) return undefined;

	const hashIdx = inner.indexOf("#");
	if (hashIdx < 0) {
		return { gameName: inner, tagLine: DEFAULT_TAG_LINE, tagExplicit: false };
	}

	const gameName = inner.slice(0, hashIdx).trim();
	const tagLine = inner.slice(hashIdx + 1).trim();
	if (!gameName || !tagLine) return undefined;
	return { gameName, tagLine, tagExplicit: true };
}

export function formatRiotIdSuggestion(extracted: ExtractedRiotId): string {
	return `${extracted.gameName}#${extracted.tagLine}`;
}
