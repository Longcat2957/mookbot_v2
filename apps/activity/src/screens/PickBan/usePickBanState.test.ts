// @vitest-environment happy-dom
//
// usePickBanState 단위 테스트 — SWR 흐름은 useStaleWhileRevalidate mock 으로
// onApply 를 캡처해서 직접 트리거. api / ws / perms 도 mock.

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SwrOptions, SwrState } from "../../state/useStaleWhileRevalidate.js";
import { emptyGameDraft, type PickBanDraft, type SeriesDetail } from "./types.js";
import { usePickBanState } from "./usePickBanState.js";

// ---- mocks --------------------------------------------------------------

const apiMock = vi.fn();
vi.mock("../../api/rest.js", () => ({ api: (...args: unknown[]) => apiMock(...args) }));

let wsCallback: (() => void) | null = null;
const wsUnsubscribe = vi.fn();
vi.mock("../../api/ws.js", () => ({
	wsClient: {
		subscribe: (_topic: string, cb: () => void) => {
			wsCallback = cb;
			return () => wsUnsubscribe();
		},
	},
}));

const showToastMock = vi.fn();
vi.mock("../../components/Toaster.js", () => ({ showToast: () => showToastMock() }));

let canEditMock = true;
vi.mock("../../state/perms.js", () => ({
	usePerms: () => ({ canEdit: canEditMock }),
}));

// SWR mock — onApply 캡처 + data/refresh 제어. hook 이 렌더마다 useStaleWhileRevalidate
// 를 두 번 호출 (detail / champions). 호출 카운트의 짝/홀로 구분 — 짝=detail, 홀=champions.
type SwrCall<T> = {
	data: T | null;
	error: string | null;
	onApply?: SwrOptions<T>["onApply"];
	refresh: () => void;
};
let detailSwr: SwrCall<SeriesDetail>;
let champSwr: SwrCall<unknown>;
let swrCallIndex = 0;
vi.mock("../../state/useStaleWhileRevalidate.js", () => ({
	useStaleWhileRevalidate: <T>(
		_key: unknown,
		_fetcher: () => Promise<T>,
		opts?: SwrOptions<T>,
	): SwrState<T> => {
		const isDetail = swrCallIndex % 2 === 0;
		swrCallIndex++;
		const slot = isDetail
			? (detailSwr as unknown as SwrCall<T>)
			: (champSwr as unknown as SwrCall<T>);
		slot.onApply = opts?.onApply;
		return {
			data: slot.data,
			error: slot.error,
			refreshing: false,
			refresh: slot.refresh,
		};
	},
}));

// ---- helpers ------------------------------------------------------------

function makeDetail(overrides: Partial<SeriesDetail["series"]> = {}): SeriesDetail {
	return {
		series: {
			id: 42,
			status: "IN_PROGRESS",
			startedAt: 0,
			winningTeam: null,
			...overrides,
		},
		participants: [
			// 1v1 — minimal valid (양 팀 TOP)
			{
				userId: "u1",
				displayName: "u1",
				team: "TEAM_1",
				role: "TOP",
				laneMmr: 1500,
				history: {
					total: { plays: 0, wins: 0, losses: 0 },
					topChampions: [],
					topChampionsByRole: {},
					rolePlays: [],
					topRole: null,
				},
			},
			{
				userId: "u2",
				displayName: "u2",
				team: "TEAM_2",
				role: "TOP",
				laneMmr: 1500,
				history: {
					total: { plays: 0, wins: 0, losses: 0 },
					topChampions: [],
					topChampionsByRole: {},
					rolePlays: [],
					topRole: null,
				},
			},
		],
		games: [],
		pickbanDraft: null,
	};
}

function freshDraft(): PickBanDraft {
	return {
		games: [1, 2, 3].map((n) => emptyGameDraft(n, 1, 1)),
		currentGame: 1,
	};
}

beforeEach(() => {
	apiMock.mockReset().mockResolvedValue(undefined);
	wsCallback = null;
	wsUnsubscribe.mockReset();
	showToastMock.mockReset();
	canEditMock = true;
	swrCallIndex = 0;
	detailSwr = { data: null, error: null, refresh: vi.fn() };
	champSwr = { data: [], error: null, refresh: vi.fn() };
});

afterEach(() => {
	vi.useRealTimers();
});

// ---- tests --------------------------------------------------------------

describe("usePickBanState — 첫 로드 / dirty 보호", () => {
	it("첫 로드 — server pickbanDraft 없으면 fresh draft 생성", () => {
		const { result, rerender } = renderHook(() => usePickBanState({ seriesId: 42 }));
		// 초기 — detail null → draft null
		expect(result.current.draft).toBeNull();

		// SWR onApply 시뮬 (server 응답 도착)
		const detail = makeDetail();
		detailSwr.data = detail;
		act(() => detailSwr.onApply?.(detail, null));
		rerender();

		expect(result.current.draft).not.toBeNull();
		expect(result.current.draft?.games).toHaveLength(3);
		expect(result.current.draft?.currentGame).toBe(1);
		expect(result.current.draft?.games[0]?.team1Side).toBeNull();
	});

	it("첫 로드 — server pickbanDraft 가 있으면 그것을 우선", () => {
		const { result, rerender } = renderHook(() => usePickBanState({ seriesId: 42 }));
		const detail = makeDetail();
		const serverDraft = freshDraft();
		serverDraft.games[0]!.team1Side = "BLUE";
		serverDraft.currentGame = 2;
		detail.pickbanDraft = serverDraft;
		detailSwr.data = detail;
		act(() => detailSwr.onApply?.(detail, null));
		rerender();

		expect(result.current.draft?.currentGame).toBe(2);
		expect(result.current.draft?.games[0]?.team1Side).toBe("BLUE");
	});

	it("dirty 보호 — 본인이 변경한 draft 는 incoming 으로 안 덮임", () => {
		vi.useFakeTimers();
		const { result, rerender } = renderHook(() => usePickBanState({ seriesId: 42 }));
		const detail = makeDetail();
		detailSwr.data = detail;
		act(() => detailSwr.onApply?.(detail, null));
		rerender();

		// 본인이 사이드 변경 (dirty)
		act(() => result.current.setSide("RED"));
		rerender();
		expect(result.current.draft?.games[0]?.team1Side).toBe("RED");

		// 새 incoming 도착 — pickbanDraft 가 다른 값
		const incomingDraft = freshDraft();
		incomingDraft.games[0]!.team1Side = "BLUE";
		const incomingDetail = makeDetail();
		incomingDetail.pickbanDraft = incomingDraft;
		act(() => detailSwr.onApply?.(incomingDetail, detail));
		rerender();

		// 본인 dirty 가 살아남음 (RED 유지)
		expect(result.current.draft?.games[0]?.team1Side).toBe("RED");
	});
});

describe("usePickBanState — 액션", () => {
	it("setSide / setCurrentGame / setGameDraft", () => {
		const { result, rerender } = renderHook(() => usePickBanState({ seriesId: 42 }));
		const detail = makeDetail();
		detail.games = [
			{
				id: 1,
				gameNumber: 1,
				team1Side: "BLUE",
				winningTeam: "TEAM_1",
				durationSec: null,
				picks: [],
			},
		];
		detailSwr.data = detail;
		act(() => detailSwr.onApply?.(detail, null));
		rerender();

		// setSide
		act(() => result.current.setSide("RED"));
		rerender();
		// 현재 game 은 1 — but Game 1 은 이미 기록됨, currentGame 은 그대로 1
		expect(result.current.draft?.games[0]?.team1Side).toBe("RED");

		// setCurrentGame: Game 2 로 — Game 1 이 완료됐으니 가능
		act(() => result.current.setCurrentGame(2));
		rerender();
		expect(result.current.draft?.currentGame).toBe(2);

		// setCurrentGame: Game 3 — Game 2 미완료 → 무시
		act(() => result.current.setCurrentGame(3));
		rerender();
		expect(result.current.draft?.currentGame).toBe(2);

		// setGameDraft 로 현재 game 의 draft 교체
		act(() =>
			result.current.setGameDraft({
				gameNumber: 2,
				team1Side: "BLUE",
				bans: { TEAM_1: [99], TEAM_2: [88] },
				picks: { TEAM_1: [77], TEAM_2: [66] },
			}),
		);
		rerender();
		expect(result.current.draft?.games[1]?.bans.TEAM_1).toEqual([99]);
		expect(result.current.draft?.games[1]?.picks.TEAM_2).toEqual([66]);
	});
});

describe("usePickBanState — derived", () => {
	it("isGameTabEnabled — Game 1 항상 / 다음 game 은 이전 완료 후", () => {
		const { result, rerender } = renderHook(() => usePickBanState({ seriesId: 42 }));
		const detail = makeDetail();
		detail.games = [
			{
				id: 1,
				gameNumber: 1,
				team1Side: "BLUE",
				winningTeam: "TEAM_1",
				durationSec: null,
				picks: [],
			},
		];
		detailSwr.data = detail;
		act(() => detailSwr.onApply?.(detail, null));
		rerender();

		expect(result.current.isGameTabEnabled(1)).toBe(true);
		expect(result.current.isGameTabEnabled(2)).toBe(true); // Game 1 완료
		expect(result.current.isGameTabEnabled(3)).toBe(false); // Game 2 미완료
	});

	it("t1Wins / t2Wins / seriesCompleted / winning team", () => {
		const { result, rerender } = renderHook(() => usePickBanState({ seriesId: 42 }));
		const detail = makeDetail({ status: "COMPLETED", winningTeam: "TEAM_1" });
		detail.games = [
			{
				id: 1,
				gameNumber: 1,
				team1Side: "BLUE",
				winningTeam: "TEAM_1",
				durationSec: null,
				picks: [],
			},
			{
				id: 2,
				gameNumber: 2,
				team1Side: "RED",
				winningTeam: "TEAM_1",
				durationSec: null,
				picks: [],
			},
		];
		detailSwr.data = detail;
		act(() => detailSwr.onApply?.(detail, null));
		rerender();

		expect(result.current.t1Wins).toBe(2);
		expect(result.current.t2Wins).toBe(0);
		expect(result.current.seriesCompleted).toBe(true);
		expect(result.current.noGamesPlayed).toBe(false);
	});

	it("fearlessUsedIds — 이전 게임 + 이전 draft 의 픽 합산, 현재 게임 제외", () => {
		const { result, rerender } = renderHook(() => usePickBanState({ seriesId: 42 }));
		const detail = makeDetail();
		// Game 1 기록됨 — 픽 10, 20
		detail.games = [
			{
				id: 1,
				gameNumber: 1,
				team1Side: "BLUE",
				winningTeam: "TEAM_1",
				durationSec: null,
				picks: [
					{ team: "TEAM_1", role: "TOP", championName: "A", championId: 10 },
					{ team: "TEAM_2", role: "TOP", championName: "B", championId: 20 },
				],
			},
		];
		// 서버 draft 에 Game 2 픽 (30) 미리 작성, currentGame = 3
		const serverDraft = freshDraft();
		serverDraft.games[1]!.picks.TEAM_1 = [30];
		serverDraft.games[2]!.picks.TEAM_1 = [40]; // 현재 게임 — 제외돼야
		serverDraft.currentGame = 3;
		detail.pickbanDraft = serverDraft;
		detailSwr.data = detail;
		act(() => detailSwr.onApply?.(detail, null));
		rerender();

		const used = result.current.fearlessUsedIds;
		expect(used.has(10)).toBe(true);
		expect(used.has(20)).toBe(true);
		expect(used.has(30)).toBe(true);
		expect(used.has(40)).toBe(false); // 현재 게임은 비활성 대상 아님
	});
});

describe("usePickBanState — revert / undoLast", () => {
	it("revert 성공 — true 반환", async () => {
		apiMock.mockResolvedValue(undefined);
		const { result, rerender } = renderHook(() => usePickBanState({ seriesId: 42 }));
		detailSwr.data = makeDetail();
		act(() => detailSwr.onApply?.(detailSwr.data!, null));
		rerender();

		const ok = await act(async () => result.current.revert());
		expect(ok).toBe(true);
		expect(apiMock).toHaveBeenCalledWith("/series/42/revert", { method: "POST" });
	});

	it("revert 실패 — false 반환 + actionError 세팅", async () => {
		apiMock.mockRejectedValue(new Error("boom"));
		const { result, rerender } = renderHook(() => usePickBanState({ seriesId: 42 }));
		detailSwr.data = makeDetail();
		act(() => detailSwr.onApply?.(detailSwr.data!, null));
		rerender();

		const ok = await act(async () => result.current.revert());
		expect(ok).toBe(false);
		rerender();
		expect(result.current.actionError).toContain("boom");
	});

	it("undoLast 성공 — refresh 호출", async () => {
		apiMock.mockResolvedValue(undefined);
		const { result, rerender } = renderHook(() => usePickBanState({ seriesId: 42 }));
		detailSwr.data = makeDetail();
		act(() => detailSwr.onApply?.(detailSwr.data!, null));
		rerender();

		await act(async () => result.current.undoLast());
		expect(apiMock).toHaveBeenCalledWith("/series/42/games/last", { method: "DELETE" });
		expect(detailSwr.refresh).toHaveBeenCalled();
	});
});

describe("usePickBanState — debounced save", () => {
	it("draft 변경 → 400ms 후 PUT (canEdit)", async () => {
		vi.useFakeTimers();
		const { result, rerender } = renderHook(() => usePickBanState({ seriesId: 42 }));
		detailSwr.data = makeDetail();
		act(() => detailSwr.onApply?.(detailSwr.data!, null));
		rerender();

		// 변경
		act(() => result.current.setSide("BLUE"));
		rerender();

		// 400ms 미만 — 아직 PUT 없음 (apiMock 은 detail fetcher 호출 안 됨, mock 이라)
		expect(apiMock).not.toHaveBeenCalled();

		await act(async () => {
			vi.advanceTimersByTime(450);
			await Promise.resolve();
		});

		expect(apiMock).toHaveBeenCalledWith(
			"/series/42/pickban",
			expect.objectContaining({ method: "PUT" }),
		);
	});

	it("canEdit=false 면 save 안 함", async () => {
		vi.useFakeTimers();
		canEditMock = false;
		const { result, rerender } = renderHook(() => usePickBanState({ seriesId: 42 }));
		detailSwr.data = makeDetail();
		act(() => detailSwr.onApply?.(detailSwr.data!, null));
		rerender();

		act(() => result.current.setSide("BLUE"));
		rerender();
		await act(async () => {
			vi.advanceTimersByTime(450);
			await Promise.resolve();
		});
		expect(apiMock).not.toHaveBeenCalled();
	});
});

describe("usePickBanState — WS / 단축키", () => {
	it("WS subscribe 후 callback 호출 시 refresh + toast", () => {
		const { rerender } = renderHook(() => usePickBanState({ seriesId: 42 }));
		detailSwr.data = makeDetail();
		act(() => detailSwr.onApply?.(detailSwr.data!, null));
		rerender();

		expect(wsCallback).not.toBeNull();
		act(() => wsCallback?.());
		expect(detailSwr.refresh).toHaveBeenCalled();
		expect(showToastMock).toHaveBeenCalled();
	});

	it("1/2/3 단축키 — 게임 탭 전환 (활성화된 탭만)", () => {
		const { result, rerender } = renderHook(() => usePickBanState({ seriesId: 42 }));
		const detail = makeDetail();
		detail.games = [
			{
				id: 1,
				gameNumber: 1,
				team1Side: "BLUE",
				winningTeam: "TEAM_1",
				durationSec: null,
				picks: [],
			},
		];
		detailSwr.data = detail;
		act(() => detailSwr.onApply?.(detail, null));
		rerender();

		// "2" 키 — Game 1 완료라 가능
		act(() => {
			window.dispatchEvent(new KeyboardEvent("keydown", { key: "2" }));
		});
		rerender();
		expect(result.current.draft?.currentGame).toBe(2);

		// "3" 키 — Game 2 미완료라 무시
		act(() => {
			window.dispatchEvent(new KeyboardEvent("keydown", { key: "3" }));
		});
		rerender();
		expect(result.current.draft?.currentGame).toBe(2);
	});

	it("input 안에서는 단축키 무시", () => {
		const { result, rerender } = renderHook(() => usePickBanState({ seriesId: 42 }));
		const detail = makeDetail();
		detail.games = [
			{
				id: 1,
				gameNumber: 1,
				team1Side: "BLUE",
				winningTeam: "TEAM_1",
				durationSec: null,
				picks: [],
			},
		];
		detailSwr.data = detail;
		act(() => detailSwr.onApply?.(detail, null));
		rerender();

		const input = document.createElement("input");
		document.body.appendChild(input);
		input.focus();
		try {
			act(() => {
				window.dispatchEvent(new KeyboardEvent("keydown", { key: "2" }));
			});
			rerender();
			expect(result.current.draft?.currentGame).toBe(1);
		} finally {
			document.body.removeChild(input);
		}
	});
});
