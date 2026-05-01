// Data Dragon 챔피언 카탈로그 — Activity 챔프 그리드/검색용.

import { datadragon } from "@mookbot/core";
import type { FastifyInstance } from "fastify";
import { requireSession, rewriteDD } from "./_helpers.js";

export async function registerChampionsRoutes(app: FastifyInstance): Promise<void> {
	app.get("/api/champions", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;

		return {
			champions: datadragon.getAllChampions().map((c) => ({ ...c, iconUrl: rewriteDD(c.iconUrl) })),
		};
	});
}
