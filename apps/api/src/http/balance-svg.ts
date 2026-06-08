import { balanceSvg } from "@mookbot/core";
import type { FastifyInstance } from "fastify";
import { requireSession } from "./_helpers.js";

export async function registerBalanceSvgRoute(app: FastifyInstance): Promise<void> {
	app.get<{
		Params: { id: string };
		Querystring: { side?: string };
	}>("/api/series/:id/balance.svg", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;

		const id = Number(req.params.id);
		if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });

		const side = req.query.side === "RED" ? "RED" : "BLUE";
		const svg = await balanceSvg.buildSeriesBalanceSvg(id, side);
		if (!svg) return reply.code(404).send({ error: "not found" });

		reply.type("image/svg+xml; charset=utf-8").header("Cache-Control", "no-store").send(svg);
	});
}
