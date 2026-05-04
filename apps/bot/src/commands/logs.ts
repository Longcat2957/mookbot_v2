// /로그 — 운영자에게 audit log 웹뷰 링크를 ephemeral 로 발급.
// JWT (HS256, LOGS_JWT_SECRET) 60분 유효. 응답 base URL 은 LOGS_BASE_URL 또는 https://bot.mooklol.com.

import { type ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { SignJWT } from "jose";
import { requireOperator } from "../utils/operator.js";

const DEFAULT_BASE = "https://bot.mooklol.com";
const TOKEN_TTL_SEC = 3600; // 60min

export const data = new SlashCommandBuilder()
	.setName("로그")
	.setDescription("[운영자] audit 로그 웹뷰 링크 받기 (60분 유효)");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!(await requireOperator(interaction))) return;

	const secret = process.env.LOGS_JWT_SECRET?.trim();
	if (!secret) {
		await interaction.reply({
			content: "❌ 서버에 `LOGS_JWT_SECRET` 가 설정되지 않았습니다. 운영자에게 알려주세요.",
			ephemeral: true,
		});
		return;
	}

	const token = await new SignJWT({ kind: "logs" })
		.setProtectedHeader({ alg: "HS256" })
		.setSubject(interaction.user.id)
		.setIssuedAt()
		.setExpirationTime(`${TOKEN_TTL_SEC}s`)
		.sign(new TextEncoder().encode(secret));

	const base = process.env.LOGS_BASE_URL?.trim() || DEFAULT_BASE;
	const url = `${base}/api/logs?token=${encodeURIComponent(token)}`;

	await interaction.reply({
		content: [
			"📜 **Audit 로그 뷰어**",
			url,
			"",
			"_60분 동안 유효합니다. 만료되면 `/로그` 다시 입력하세요._",
		].join("\n"),
		ephemeral: true,
	});
}
