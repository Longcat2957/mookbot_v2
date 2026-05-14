// `pointer: coarse` 미디어쿼리 — 주 입력기가 손가락 / 펜인 환경 (모바일, Discord 모바일).
// HTML5 DnD 가 touch 에서 작동 안 하므로 tap-to-place 를 1차 인터랙션으로 광고할 때 사용.
//
// SSR-safe: window 미존재 시 false (DnD 환경) 로 가정. Discord Activity 는 항상 브라우저.

import { useEffect, useState } from "react";

const QUERY = "(pointer: coarse)";

export function useCoarsePointer(): boolean {
	const [coarse, setCoarse] = useState<boolean>(() => {
		if (typeof window === "undefined" || !window.matchMedia) return false;
		return window.matchMedia(QUERY).matches;
	});

	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return;
		const mq = window.matchMedia(QUERY);
		const onChange = (e: MediaQueryListEvent) => setCoarse(e.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);

	return coarse;
}
