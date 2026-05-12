// api → bot 내부 HTTP 호출. 같은 docker network 안에서 INTERNAL_API_KEY shared secret 인증.
//
// 용도: 모집 D1 status 가 API 측에서 바뀐 뒤 (POST /api/series, revert) 봇이 쥐고 있는
// Discord 메시지를 다시 그리도록 트리거. 봇 핸들러가 직접 D1 을 바꾸는 경우는 봇이
// 이미 메시지를 갱신하므로 이 호출이 필요 없다 — API 측 transition 만 보강.

import { log } from "@mookbot/core";

/**
 * 봇에 모집 메시지 re-render 요청. best-effort — 실패해도 캐치해서 로그만 남기고 무시.
 * (응답 user-facing 흐름을 봇 health 에 종속시키지 않기 위해)
 */
export async function notifyBotRecruitRefresh(recruitmentId: number): Promise<void> {
	const botBase = process.env.BOT_INTERNAL_BASE ?? "http://bot:3001";
	const key = process.env.INTERNAL_API_KEY;
	if (!key) {
		log.debug({ recruitmentId }, "notifyBotRecruitRefresh: INTERNAL_API_KEY 미설정 — skip");
		return;
	}

	const res = await fetch(`${botBase}/internal/recruit-refresh`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Internal-Key": key,
		},
		body: JSON.stringify({ recruitmentId }),
		// 봇이 죽어있을 수 있음 — short timeout 으로 실패 fast.
		signal: AbortSignal.timeout(3000),
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`bot refresh ${res.status}: ${text}`);
	}
}

/**
 * 봇에 시리즈 종료 카드 발행 요청. Bo3 자동 종료 직후 호출.
 * best-effort — 실패 시 caller 에서 catch + log 만 (응답 흐름 차단 X).
 */
export async function notifyBotSeriesCompleted(seriesId: number): Promise<void> {
	const botBase = process.env.BOT_INTERNAL_BASE ?? "http://bot:3001";
	const key = process.env.INTERNAL_API_KEY;
	if (!key) {
		log.debug({ seriesId }, "notifyBotSeriesCompleted: INTERNAL_API_KEY 미설정 — skip");
		return;
	}

	const res = await fetch(`${botBase}/internal/series-completed`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Internal-Key": key,
		},
		body: JSON.stringify({ seriesId }),
		signal: AbortSignal.timeout(5000),
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`bot series-completed ${res.status}: ${text}`);
	}
}

/**
 * 봇에 경매내전 종료 카드 발행 요청. 토너먼트 COMPLETED 시 호출.
 * best-effort.
 */
export async function notifyBotAuctionTournamentCompleted(tournamentId: number): Promise<void> {
	const botBase = process.env.BOT_INTERNAL_BASE ?? "http://bot:3001";
	const key = process.env.INTERNAL_API_KEY;
	if (!key) {
		log.debug(
			{ tournamentId },
			"notifyBotAuctionTournamentCompleted: INTERNAL_API_KEY 미설정 — skip",
		);
		return;
	}

	const res = await fetch(`${botBase}/internal/auction-tournament-completed`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Internal-Key": key,
		},
		body: JSON.stringify({ tournamentId }),
		signal: AbortSignal.timeout(5000),
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`bot auction-tournament-completed ${res.status}: ${text}`);
	}
}
