// 경매내전 모집 관련 라우트 — 목록 / 상세 / 인원 관리 / 취소.

import { db } from "@mookbot/core";
import type { FastifyInstance } from "fastify";
import { invalidate, requireEditor, requireSession } from "./_helpers.js";

export async function registerAuctionRecruitRoutes(app: FastifyInstance): Promise<void> {
	// 활성 경매 모집 목록 (대시보드용)
	app.get("/api/auction-recruitments", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;
		const rows = await db.listOpenAuctionRecruitments();
		return {
			recruitments: rows.map((r) => ({
				id: r.id,
				targetCount: r.target_count,
				status: r.status,
				createdBy: r.created_by,
				createdAt: r.created_at,
			})),
		};
	});

	// 단일 모집 상세
	app.get<{ Params: { id: string } }>("/api/auction-recruitments/:id", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;
		const id = Number(req.params.id);
		if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });
		const rec = await db.getAuctionRecruitment(id);
		if (!rec) return reply.code(404).send({ error: "not found" });

		const participants = await db.listAuctionRecruitmentParticipants(id);
		const userIds = participants.map((p) => p.user_id);
		const users = userIds.length > 0 ? await db.listUsers(userIds) : [];
		const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));

		return {
			recruitment: {
				id: rec.id,
				targetCount: rec.target_count,
				status: rec.status,
				convertedTournamentId: rec.converted_tournament_id,
				createdBy: rec.created_by,
				createdAt: rec.created_at,
			},
			participants: participants.map((p) => ({
				userId: p.user_id,
				displayName: nameById.get(p.user_id) ?? p.user_id,
				joinedAt: p.joined_at,
			})),
		};
	});

	// 인원 강제 추가 (운영자)
	app.post<{ Params: { id: string }; Body: { userId: string } }>(
		"/api/auction-recruitments/:id/members",
		async (req, reply) => {
			const sid = await requireEditor(req, reply);
			if (!sid) return;
			const id = Number(req.params.id);
			if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });
			const rec = await db.getAuctionRecruitment(id);
			if (!rec) return reply.code(404).send({ error: "not found" });
			if (rec.status !== "OPEN") {
				return reply.code(409).send({ error: `status=${rec.status} — 추가 불가` });
			}
			const userId = req.body?.userId;
			if (!userId) return reply.code(400).send({ error: "userId required" });

			const current = await db.listAuctionRecruitmentParticipants(id);
			if (current.length >= rec.target_count) {
				return reply.code(409).send({ error: "정원 도달" });
			}
			await db.addAuctionRecruitmentParticipant({ recruitmentId: id, userId });
			await db.recordAudit({
				operatorId: sid,
				action: "auction-recruitment.member-added",
				targetType: "auction-recruitment",
				targetId: String(id),
				payload: { userId },
			});
			invalidate(`auction-recruitment:${id}`, sid);
			invalidate("auction-dashboard", sid);
			return { ok: true };
		},
	);

	// 인원 강제 제거 (운영자)
	app.delete<{ Params: { id: string; uid: string } }>(
		"/api/auction-recruitments/:id/members/:uid",
		async (req, reply) => {
			const sid = await requireEditor(req, reply);
			if (!sid) return;
			const id = Number(req.params.id);
			if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });
			const rec = await db.getAuctionRecruitment(id);
			if (!rec) return reply.code(404).send({ error: "not found" });
			if (rec.status !== "OPEN") {
				return reply.code(409).send({ error: `status=${rec.status} — 제거 불가` });
			}
			await db.removeAuctionRecruitmentParticipant(id, req.params.uid);
			await db.recordAudit({
				operatorId: sid,
				action: "auction-recruitment.member-removed",
				targetType: "auction-recruitment",
				targetId: String(id),
				payload: { userId: req.params.uid },
			});
			invalidate(`auction-recruitment:${id}`, sid);
			invalidate("auction-dashboard", sid);
			return { ok: true };
		},
	);

	// 모집 취소
	app.post<{ Params: { id: string } }>(
		"/api/auction-recruitments/:id/cancel",
		async (req, reply) => {
			const sid = await requireEditor(req, reply);
			if (!sid) return;
			const id = Number(req.params.id);
			if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });
			const rec = await db.getAuctionRecruitment(id);
			if (!rec) return reply.code(404).send({ error: "not found" });
			if (rec.status === "CANCELLED" || rec.status === "CONVERTED") {
				return reply.code(409).send({ error: `status=${rec.status}` });
			}
			await db.setAuctionRecruitmentStatus(id, "CANCELLED");
			await db.recordAudit({
				operatorId: sid,
				action: "auction-recruitment.cancelled",
				targetType: "auction-recruitment",
				targetId: String(id),
			});
			invalidate(`auction-recruitment:${id}`, sid);
			invalidate("auction-dashboard", sid);
			return { ok: true };
		},
	);
}
