// @vitest-environment happy-dom
//
// useEntryEditingState 단위 테스트 — usePickBanState.test 와 동일 mock 패턴.

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SwrOptions, SwrState } from "../../state/useStaleWhileRevalidate.js";
import type { Participant, RecruitmentDetail } from "./types.js";
import { useEntryEditingState } from "./useEntryEditingState.js";

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

type SwrCall<T> = {
	data: T | null;
	error: string | null;
	onApply?: SwrOptions<T>["onApply"];
	refresh: () => void;
};
let recSwr: SwrCall<RecruitmentDetail>;
vi.mock("../../state/useStaleWhileRevalidate.js", () => ({
	useStaleWhileRevalidate: <T>(
		_key: unknown,
		_fetcher: () => Promise<T>,
		opts?: SwrOptions<T>,
	): SwrState<T> => {
		const slot = recSwr as unknown as SwrCall<T>;
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

function makeParticipant(userId: string, displayName = userId): Participant {
	return {
		userId,
		displayName,
		roles: [],
		joinedAt: 0,
		history: {
			total: { plays: 0, wins: 0, losses: 0 },
			topChampions: [],
			rolePlays: [],
			topRole: null,
		},
	};
}

function makeDetail(
	targetCount = 4,
	participantIds: string[] = ["a", "b", "c", "d"],
): RecruitmentDetail {
	return {
		recruitment: {
			id: 7,
			targetCount,
			status: "CLOSED",
			createdBy: "op",
			createdAt: 0,
		},
		participants: participantIds.map((id) => makeParticipant(id)),
		entryDraft: null,
	};
}

beforeEach(() => {
	apiMock.mockReset().mockResolvedValue(undefined);
	wsCallback = null;
	wsUnsubscribe.mockReset();
	showToastMock.mockReset();
	canEditMock = true;
	recSwr = { data: null, error: null, refresh: vi.fn() };
});

afterEach(() => {
	vi.useRealTimers();
});

// ---- tests --------------------------------------------------------------

describe("useEntryEditingState — 첫 로드 / dirty 보호", () => {
	it("첫 로드 — server entryDraft 없으면 빈 assignment", () => {
		const { result, rerender } = renderHook(() => useEntryEditingState({ recruitmentId: 7 }));
		const detail = makeDetail();
		recSwr.data = detail;
		act(() => recSwr.onApply?.(detail, null));
		rerender();

		expect(result.current.assignment.size).toBe(0);
		expect(result.current.unassigned).toHaveLength(4);
		expect(result.current.allFilled).toBe(false);
		expect(result.current.teamSize).toBe(2);
		expect(result.current.activeLanes).toEqual(["TOP", "JUNGLE"]);
	});

	it("첫 로드 — server entryDraft 가 있으면 반영", () => {
		const { result, rerender } = renderHook(() => useEntryEditingState({ recruitmentId: 7 }));
		const detail = makeDetail();
		detail.entryDraft = {
			assignments: { a: "TEAM_1_TOP", b: "TEAM_2_TOP" },
		};
		recSwr.data = detail;
		act(() => recSwr.onApply?.(detail, null));
		rerender();

		expect(result.current.assignment.size).toBe(2);
		expect(result.current.assignment.get("a")).toBe("TEAM_1_TOP");
		expect(result.current.unassigned.map((p) => p.userId).sort()).toEqual(["c", "d"]);
	});

	it("dirty 보호 — 본인 변경은 incoming 으로 안 덮임", () => {
		const { result, rerender } = renderHook(() => useEntryEditingState({ recruitmentId: 7 }));
		const detail = makeDetail();
		recSwr.data = detail;
		act(() => recSwr.onApply?.(detail, null));
		rerender();

		// 본인 변경
		act(() => result.current.moveTo("a", "TEAM_1_TOP"));
		rerender();
		expect(result.current.assignment.get("a")).toBe("TEAM_1_TOP");

		// 다른 운영자가 a 를 TEAM_2_TOP 으로 옮김 (incoming)
		const incoming = makeDetail();
		incoming.entryDraft = { assignments: { a: "TEAM_2_TOP" } };
		act(() => recSwr.onApply?.(incoming, detail));
		rerender();

		// 본인 dirty 가 살아남음
		expect(result.current.assignment.get("a")).toBe("TEAM_1_TOP");
	});

	it("recentlyChanged — incoming diff 추출 (dirty 여부와 무관)", () => {
		const { result, rerender } = renderHook(() => useEntryEditingState({ recruitmentId: 7 }));
		const detail = makeDetail();
		recSwr.data = detail;
		act(() => recSwr.onApply?.(detail, null));
		rerender();

		// 본인 변경 (dirty)
		act(() => result.current.moveTo("a", "TEAM_1_TOP"));
		rerender();

		// incoming — b 가 새로 배정됨
		const incoming = makeDetail();
		incoming.entryDraft = { assignments: { b: "TEAM_2_JUNGLE" } };
		act(() => recSwr.onApply?.(incoming, detail));
		rerender();

		// b 는 변경된 user 로 마킹
		expect(result.current.recentlyChanged.has("b")).toBe(true);
	});
});

describe("useEntryEditingState — moveTo", () => {
	it("빈 슬롯에 배치", () => {
		const { result, rerender } = renderHook(() => useEntryEditingState({ recruitmentId: 7 }));
		recSwr.data = makeDetail();
		act(() => recSwr.onApply?.(recSwr.data!, null));
		rerender();

		act(() => result.current.moveTo("a", "TEAM_1_TOP"));
		rerender();
		expect(result.current.assignment.get("a")).toBe("TEAM_1_TOP");
	});

	it("점유 슬롯 이동 — 이동자가 자리 없으면 점유자 unassigned", () => {
		const { result, rerender } = renderHook(() => useEntryEditingState({ recruitmentId: 7 }));
		recSwr.data = makeDetail();
		act(() => recSwr.onApply?.(recSwr.data!, null));
		rerender();

		// a → TOP
		act(() => result.current.moveTo("a", "TEAM_1_TOP"));
		rerender();
		// b (자리 없음) → 같은 자리 → a 가 unassigned
		act(() => result.current.moveTo("b", "TEAM_1_TOP"));
		rerender();
		expect(result.current.assignment.get("b")).toBe("TEAM_1_TOP");
		expect(result.current.assignment.has("a")).toBe(false);
	});

	it("점유 슬롯 이동 — 이동자가 자리 있으면 점유자와 swap", () => {
		const { result, rerender } = renderHook(() => useEntryEditingState({ recruitmentId: 7 }));
		recSwr.data = makeDetail();
		act(() => recSwr.onApply?.(recSwr.data!, null));
		rerender();

		// a 는 TOP, b 는 JUNGLE 점유 상태
		act(() => result.current.moveTo("a", "TEAM_1_TOP"));
		act(() => result.current.moveTo("b", "TEAM_2_JUNGLE"));
		rerender();
		// a 를 b 자리로 → b 가 a 자리로 swap (서로 자리 보유)
		act(() => result.current.moveTo("a", "TEAM_2_JUNGLE"));
		rerender();
		expect(result.current.assignment.get("a")).toBe("TEAM_2_JUNGLE");
		expect(result.current.assignment.get("b")).toBe("TEAM_1_TOP");
	});

	it("null 슬롯 → 후보 풀로", () => {
		const { result, rerender } = renderHook(() => useEntryEditingState({ recruitmentId: 7 }));
		recSwr.data = makeDetail();
		act(() => recSwr.onApply?.(recSwr.data!, null));
		rerender();

		act(() => result.current.moveTo("a", "TEAM_1_TOP"));
		rerender();
		act(() => result.current.moveTo("a", null));
		rerender();
		expect(result.current.assignment.has("a")).toBe(false);
	});
});

describe("useEntryEditingState — swapTeams", () => {
	it("1팀↔2팀 좌우 교체 — 모든 slot 의 team 만 토글, role 보존", () => {
		const { result, rerender } = renderHook(() => useEntryEditingState({ recruitmentId: 7 }));
		recSwr.data = makeDetail();
		act(() => recSwr.onApply?.(recSwr.data!, null));
		rerender();

		act(() => result.current.moveTo("a", "TEAM_1_TOP"));
		act(() => result.current.moveTo("b", "TEAM_2_TOP"));
		act(() => result.current.moveTo("c", "TEAM_1_JUNGLE"));
		rerender();

		act(() => result.current.swapTeams());
		rerender();

		expect(result.current.assignment.get("a")).toBe("TEAM_2_TOP");
		expect(result.current.assignment.get("b")).toBe("TEAM_1_TOP");
		expect(result.current.assignment.get("c")).toBe("TEAM_2_JUNGLE");
	});
});

describe("useEntryEditingState — allFilled / submit", () => {
	it("allFilled — 모든 활성 라인의 양 팀이 배정돼야 true", () => {
		const { result, rerender } = renderHook(() => useEntryEditingState({ recruitmentId: 7 }));
		recSwr.data = makeDetail();
		act(() => recSwr.onApply?.(recSwr.data!, null));
		rerender();

		expect(result.current.allFilled).toBe(false);

		act(() => result.current.moveTo("a", "TEAM_1_TOP"));
		act(() => result.current.moveTo("b", "TEAM_2_TOP"));
		act(() => result.current.moveTo("c", "TEAM_1_JUNGLE"));
		rerender();
		expect(result.current.allFilled).toBe(false);

		act(() => result.current.moveTo("d", "TEAM_2_JUNGLE"));
		rerender();
		expect(result.current.allFilled).toBe(true);
	});

	it("submit 성공 — { seriesId } 반환 + POST /series 호출", async () => {
		apiMock.mockResolvedValue({ seriesId: 99 });
		const { result, rerender } = renderHook(() => useEntryEditingState({ recruitmentId: 7 }));
		recSwr.data = makeDetail();
		act(() => recSwr.onApply?.(recSwr.data!, null));
		rerender();
		// 모두 채움
		act(() => {
			result.current.moveTo("a", "TEAM_1_TOP");
			result.current.moveTo("b", "TEAM_2_TOP");
			result.current.moveTo("c", "TEAM_1_JUNGLE");
			result.current.moveTo("d", "TEAM_2_JUNGLE");
		});
		rerender();

		const res = await act(async () => result.current.submit());
		expect(res).toEqual({ seriesId: 99 });
		expect(apiMock).toHaveBeenCalledWith("/series", expect.objectContaining({ method: "POST" }));
		// body 에 assignments 배열 포함
		const callBody = JSON.parse((apiMock.mock.calls[0]?.[1] as { body: string }).body);
		expect(callBody.recruitmentId).toBe(7);
		expect(callBody.assignments).toHaveLength(4);
		expect(callBody.assignments[0]).toMatchObject({
			team: expect.stringMatching(/TEAM_[12]/),
			role: expect.stringMatching(/TOP|JUNGLE/),
		});
	});

	it("submit allFilled=false 면 호출 자체 안 함 → null 반환", async () => {
		const { result, rerender } = renderHook(() => useEntryEditingState({ recruitmentId: 7 }));
		recSwr.data = makeDetail();
		act(() => recSwr.onApply?.(recSwr.data!, null));
		rerender();

		const res = await act(async () => result.current.submit());
		expect(res).toBeNull();
		expect(apiMock).not.toHaveBeenCalled();
	});

	it("submit 실패 — null 반환 + submitError 세팅", async () => {
		apiMock.mockRejectedValue(new Error("conflict"));
		const { result, rerender } = renderHook(() => useEntryEditingState({ recruitmentId: 7 }));
		recSwr.data = makeDetail();
		act(() => recSwr.onApply?.(recSwr.data!, null));
		rerender();
		act(() => {
			result.current.moveTo("a", "TEAM_1_TOP");
			result.current.moveTo("b", "TEAM_2_TOP");
			result.current.moveTo("c", "TEAM_1_JUNGLE");
			result.current.moveTo("d", "TEAM_2_JUNGLE");
		});
		rerender();

		const res = await act(async () => result.current.submit());
		expect(res).toBeNull();
		rerender();
		expect(result.current.submitError).toContain("conflict");
	});
});

describe("useEntryEditingState — Tap-to-Place", () => {
	it("handleParticipantTap — 같은 user 다시 탭하면 toggle off", () => {
		const { result, rerender } = renderHook(() => useEntryEditingState({ recruitmentId: 7 }));
		recSwr.data = makeDetail();
		act(() => recSwr.onApply?.(recSwr.data!, null));
		rerender();

		act(() => result.current.handleParticipantTap("a"));
		rerender();
		expect(result.current.selectedUid).toBe("a");

		act(() => result.current.handleParticipantTap("a"));
		rerender();
		expect(result.current.selectedUid).toBeNull();
	});

	it("handleSlotTap — selected 있으면 거기로 이동, 없으면 점유자 select", () => {
		const { result, rerender } = renderHook(() => useEntryEditingState({ recruitmentId: 7 }));
		recSwr.data = makeDetail();
		act(() => recSwr.onApply?.(recSwr.data!, null));
		rerender();

		// a 선택 → TEAM_1_TOP 슬롯 탭 → 거기로
		act(() => result.current.handleParticipantTap("a"));
		rerender();
		act(() => result.current.handleSlotTap("TEAM_1_TOP", null));
		rerender();
		expect(result.current.assignment.get("a")).toBe("TEAM_1_TOP");
		expect(result.current.selectedUid).toBeNull();

		// 빈 selected 상태에서 점유 슬롯 탭 → 점유자 select
		act(() => result.current.handleSlotTap("TEAM_1_TOP", "a"));
		rerender();
		expect(result.current.selectedUid).toBe("a");
	});

	it("handlePoolTap — selected 가 슬롯 점유자면 unassign", () => {
		const { result, rerender } = renderHook(() => useEntryEditingState({ recruitmentId: 7 }));
		recSwr.data = makeDetail();
		act(() => recSwr.onApply?.(recSwr.data!, null));
		rerender();

		act(() => result.current.moveTo("a", "TEAM_1_TOP"));
		act(() => result.current.handleParticipantTap("a")); // 슬롯에서 select
		rerender();

		act(() => result.current.handlePoolTap());
		rerender();
		expect(result.current.assignment.has("a")).toBe(false);
		expect(result.current.selectedUid).toBeNull();
	});

	it("canEdit=false 면 tap 핸들러가 모두 no-op", () => {
		canEditMock = false;
		const { result, rerender } = renderHook(() => useEntryEditingState({ recruitmentId: 7 }));
		recSwr.data = makeDetail();
		act(() => recSwr.onApply?.(recSwr.data!, null));
		rerender();

		act(() => result.current.handleParticipantTap("a"));
		rerender();
		expect(result.current.selectedUid).toBeNull();

		act(() => result.current.handleSlotTap("TEAM_1_TOP", null));
		rerender();
		expect(result.current.assignment.size).toBe(0);
	});

	it("Esc 키 — selected 해제", () => {
		const { result, rerender } = renderHook(() => useEntryEditingState({ recruitmentId: 7 }));
		recSwr.data = makeDetail();
		act(() => recSwr.onApply?.(recSwr.data!, null));
		rerender();

		act(() => result.current.handleParticipantTap("a"));
		rerender();
		expect(result.current.selectedUid).toBe("a");

		act(() => {
			window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		});
		rerender();
		expect(result.current.selectedUid).toBeNull();
	});
});

describe("useEntryEditingState — debounced save / WS", () => {
	it("assignment 변경 → 250ms 후 PUT (canEdit)", async () => {
		vi.useFakeTimers();
		const { result, rerender } = renderHook(() => useEntryEditingState({ recruitmentId: 7 }));
		recSwr.data = makeDetail();
		act(() => recSwr.onApply?.(recSwr.data!, null));
		rerender();

		act(() => result.current.moveTo("a", "TEAM_1_TOP"));
		rerender();

		expect(apiMock).not.toHaveBeenCalled();

		await act(async () => {
			vi.advanceTimersByTime(300);
			await Promise.resolve();
		});

		expect(apiMock).toHaveBeenCalledWith(
			"/recruitments/7/entry-draft",
			expect.objectContaining({ method: "PUT" }),
		);
	});

	it("WS subscribe → callback 호출 시 refresh + toast", () => {
		const { rerender } = renderHook(() => useEntryEditingState({ recruitmentId: 7 }));
		recSwr.data = makeDetail();
		act(() => recSwr.onApply?.(recSwr.data!, null));
		rerender();

		expect(wsCallback).not.toBeNull();
		act(() => wsCallback?.());
		expect(recSwr.refresh).toHaveBeenCalled();
		expect(showToastMock).toHaveBeenCalled();
	});
});
