// Wave 5.1 smoke — in-memory SQLite 위에서 db/recruitments.ts 동작 확인.

import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, installDbDriver, type TestDb } from "../test-utils/db-harness.js";

import {
	addRecruitmentParticipant,
	createRecruitment,
	deleteRecruitment,
	getRecruitment,
	isRecruitmentParticipant,
	listBuildableRecruitments,
	listCancellableRecruitments,
	listOpenRecruitments,
	listRecruitmentParticipants,
	listStaleOpenRecruitments,
	removeRecruitmentParticipant,
	setRecruitmentMessage,
	setRecruitmentRoles,
	setRecruitmentStatus,
} from "./recruitments.js";
import { createSeason } from "./seasons.js";
import { upsertUser } from "./users.js";

let db: TestDb;
let seasonId: number;
const OPERATOR_ID = "operator-discord-id";

beforeEach(async () => {
	db = createTestDb();
	installDbDriver(db);

	const season = await createSeason("Test Season");
	seasonId = season.id;
	await upsertUser(OPERATOR_ID, "Operator");
});

describe("recruitments — round-trip", () => {
	it("createRecruitment + getRecruitment", async () => {
		const created = await createRecruitment({
			seasonId,
			targetCount: 4,
			createdBy: OPERATOR_ID,
		});

		expect(created.id).toBeGreaterThan(0);
		expect(created.season_id).toBe(seasonId);
		expect(created.target_count).toBe(4);
		expect(created.status).toBe("OPEN");
		expect(created.created_by).toBe(OPERATOR_ID);

		const fetched = await getRecruitment(created.id);
		expect(fetched).toEqual(created);
	});

	it("getRecruitment returns undefined for unknown id", async () => {
		expect(await getRecruitment(99999)).toBeUndefined();
	});

	it("listOpenRecruitments excludes CANCELLED / CONVERTED", async () => {
		const r1 = await createRecruitment({ seasonId, targetCount: 2, createdBy: OPERATOR_ID });
		const r2 = await createRecruitment({ seasonId, targetCount: 2, createdBy: OPERATOR_ID });
		await createRecruitment({ seasonId, targetCount: 2, createdBy: OPERATOR_ID });

		await setRecruitmentStatus(r1.id, "CANCELLED");
		await setRecruitmentStatus(r2.id, "CONVERTED");

		const open = await listOpenRecruitments();
		expect(open.map((r) => r.id)).not.toContain(r1.id);
		expect(open.map((r) => r.id)).not.toContain(r2.id);
		expect(open.length).toBe(1);
	});
});

describe("recruitments — participants", () => {
	it("add / list / isParticipant / remove", async () => {
		const rec = await createRecruitment({
			seasonId,
			targetCount: 4,
			createdBy: OPERATOR_ID,
		});
		await upsertUser("user-A", "Alice");
		await upsertUser("user-B", "Bob");

		await addRecruitmentParticipant({ recruitmentId: rec.id, userId: "user-A" });
		await addRecruitmentParticipant({ recruitmentId: rec.id, userId: "user-B" });

		expect(await isRecruitmentParticipant(rec.id, "user-A")).toBe(true);
		expect(await isRecruitmentParticipant(rec.id, "user-Z")).toBe(false);

		const list = await listRecruitmentParticipants(rec.id);
		expect(list.map((p) => p.user_id).sort()).toEqual(["user-A", "user-B"]);
		// 신규 참가자는 라인 무관 (빈 roles[])
		expect(list.find((p) => p.user_id === "user-A")?.roles).toEqual([]);

		await removeRecruitmentParticipant(rec.id, "user-A");
		expect(await isRecruitmentParticipant(rec.id, "user-A")).toBe(false);
		expect(await listRecruitmentParticipants(rec.id)).toHaveLength(1);
	});

	it("setRecruitmentRoles 가 라인 선호 갱신", async () => {
		const rec = await createRecruitment({
			seasonId,
			targetCount: 2,
			createdBy: OPERATOR_ID,
		});
		await upsertUser("user-A", "Alice");
		await addRecruitmentParticipant({ recruitmentId: rec.id, userId: "user-A" });

		await setRecruitmentRoles(rec.id, "user-A", ["TOP", "MID"]);
		const list = await listRecruitmentParticipants(rec.id);
		const alice = list.find((p) => p.user_id === "user-A");
		expect(alice?.roles.sort()).toEqual(["MID", "TOP"]);

		// overwrite — 이전 roles 모두 교체
		await setRecruitmentRoles(rec.id, "user-A", ["JUNGLE"]);
		const after = await listRecruitmentParticipants(rec.id);
		expect(after.find((p) => p.user_id === "user-A")?.roles).toEqual(["JUNGLE"]);
	});
});

describe("recruitments — message tracking + lists + delete", () => {
	it("setRecruitmentMessage 가 channel/message id 저장", async () => {
		const rec = await createRecruitment({
			seasonId,
			targetCount: 2,
			createdBy: OPERATOR_ID,
		});
		await setRecruitmentMessage(rec.id, "ch-123", "msg-456");
		const after = await getRecruitment(rec.id);
		expect(after?.channel_id).toBe("ch-123");
		expect(after?.message_id).toBe("msg-456");
	});

	it("listCancellableRecruitments OPEN+CLOSED, exclude CONVERTED/CANCELLED", async () => {
		const r1 = await createRecruitment({ seasonId, targetCount: 2, createdBy: OPERATOR_ID });
		const r2 = await createRecruitment({ seasonId, targetCount: 2, createdBy: OPERATOR_ID });
		const r3 = await createRecruitment({ seasonId, targetCount: 2, createdBy: OPERATOR_ID });
		const r4 = await createRecruitment({ seasonId, targetCount: 2, createdBy: OPERATOR_ID });

		await setRecruitmentStatus(r2.id, "CLOSED");
		await setRecruitmentStatus(r3.id, "CONVERTED");
		await setRecruitmentStatus(r4.id, "CANCELLED");

		const list = await listCancellableRecruitments();
		expect(list.map((r) => r.id).sort()).toEqual([r1.id, r2.id].sort());
	});

	it("listBuildableRecruitments OPEN+CLOSED 도 같은 셋 반환", async () => {
		const r = await createRecruitment({ seasonId, targetCount: 2, createdBy: OPERATOR_ID });
		await setRecruitmentStatus(r.id, "CLOSED");
		const list = await listBuildableRecruitments();
		expect(list.find((x) => x.id === r.id)).toBeDefined();
	});

	it("listStaleOpenRecruitments 가 cutoff 이전 OPEN 만", async () => {
		const fresh = await createRecruitment({
			seasonId,
			targetCount: 2,
			createdBy: OPERATOR_ID,
		});
		// future cutoff (== created_at - 1) → 결과 없음
		expect(await listStaleOpenRecruitments(fresh.created_at - 1)).toEqual([]);
		// past cutoff (created_at + 1) → include
		const stale = await listStaleOpenRecruitments(fresh.created_at + 1);
		expect(stale.map((r) => r.id)).toContain(fresh.id);
	});

	it("deleteRecruitment 삭제 + cascade", async () => {
		const rec = await createRecruitment({
			seasonId,
			targetCount: 2,
			createdBy: OPERATOR_ID,
		});
		await upsertUser("u1", "U1");
		await addRecruitmentParticipant({ recruitmentId: rec.id, userId: "u1" });

		await deleteRecruitment(rec.id);
		expect(await getRecruitment(rec.id)).toBeUndefined();
		// CASCADE: 참가자도 삭제
		expect(await listRecruitmentParticipants(rec.id)).toEqual([]);
	});
});
