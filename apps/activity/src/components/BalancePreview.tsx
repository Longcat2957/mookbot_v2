// 밸런스 이미지 미리보기 — PickBan 화면이 Game 1 사이드 결정 후 노출.
//
// /api/series/:id/balance.svg?side=... 를 fetch 해서 inline SVG 로 표시.
// inline 으로 띄워서 Discord Activity iframe sandbox 의 CSP / cookie 흐름 영향 0.
//
// 사용자 액션:
//   - "이미지 새 탭에서 열기" — 작업 / 캡처용
//   - "URL 복사" — Discord 채널 직접 공유 시
//
// Discord 채널 자동 업로드는 후속 PR (sharp PNG 변환 + webhook).

import { useEffect, useState } from "react";

interface Props {
	seriesId: number;
	team1Side: "BLUE" | "RED";
}

export function BalancePreview({ seriesId, team1Side }: Props) {
	const [svgText, setSvgText] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const url = `/api/series/${seriesId}/balance.svg?side=${team1Side}`;

	useEffect(() => {
		let cancelled = false;
		setSvgText(null);
		setError(null);
		fetch(url, { credentials: "same-origin" })
			.then(async (r) => {
				if (!r.ok) throw new Error(`HTTP ${r.status}`);
				return r.text();
			})
			.then((txt) => {
				if (!cancelled) setSvgText(txt);
			})
			.catch((err: unknown) => {
				if (!cancelled) setError(err instanceof Error ? err.message : String(err));
			});
		return () => {
			cancelled = true;
		};
	}, [url]);

	const copyUrl = async () => {
		const fullUrl = new URL(url, window.location.origin).toString();
		try {
			await navigator.clipboard.writeText(fullUrl);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1200);
		} catch {
			// clipboard api 실패 시 — Discord Activity sandbox 일부 환경에서 막힘
			window.prompt("URL 을 복사하세요", fullUrl);
		}
	};

	return (
		<details className="collapse collapse-arrow bg-base-200 shadow-sm" open>
			<summary className="collapse-title text-sm font-medium py-2 min-h-0 px-3">
				🎯 밸런스 미리보기 (Game 1 · 1팀 {team1Side})
			</summary>
			<div className="collapse-content px-3 pb-3 space-y-2">
				{error && (
					<div className="alert alert-error text-xs">
						<span>이미지를 불러오지 못했습니다: {error}</span>
					</div>
				)}
				{!svgText && !error && (
					<div className="flex items-center gap-2 py-6 justify-center text-base-content/60 text-sm">
						<span className="loading loading-spinner loading-sm" />
						이미지 생성 중…
					</div>
				)}
				{svgText && (
					<>
						<div
							className="rounded-md overflow-hidden border border-base-300"
							// SVG 는 신뢰된 api 출력 (escXml 처리 + 사용자 입력 sanitize)
							// biome-ignore lint/security/noDangerouslySetInnerHtml: api-rendered SVG only
							dangerouslySetInnerHTML={{ __html: svgText }}
						/>
						<div className="flex flex-wrap gap-2 justify-end">
							<a className="btn btn-xs btn-ghost" href={url} target="_blank" rel="noreferrer">
								↗ 새 탭에서 열기
							</a>
							<button type="button" className="btn btn-xs btn-ghost" onClick={copyUrl}>
								{copied ? "✓ 복사됨" : "🔗 URL 복사"}
							</button>
						</div>
					</>
				)}
			</div>
		</details>
	);
}
