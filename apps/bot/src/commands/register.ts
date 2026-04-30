import {
	type ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
} from "discord.js";
import { db, riot } from "@mookbot/core";

export const data = new SlashCommandBuilder()
	.setName("등록")
	.setDescription("내전 참가자로 등록 (라이엇 ID 연결은 선택)")
	.addStringOption((o) =>
		o
			.setName("riot_id")
			.setDescription("(선택) GameName#TagLine. 비우면 디스코드 계정만 등록")
			.setRequired(false),
	);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	const riotIdInput = interaction.options.getString("riot_id");
	await interaction.deferReply({ ephemeral: true });

	const member = interaction.guild
		? await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
		: null;
	const displayName =
		member?.displayName ?? interaction.user.displayName ?? interaction.user.username;
	await db.upsertUser(interaction.user.id, displayName);

	if (!riotIdInput) {
		const existing = await db.getMainRiotAccount(interaction.user.id);
		const riotInfo = existing
			? `\n현재 연결된 라이엇 계정: **${existing.game_name}#${existing.tag_line}**`
			: "\n라이엇 ID 연결은 `/등록 riot_id:GameName#TagLine` 으로 다시 실행하세요. (선택)";
		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setTitle("✅ 등록 완료")
					.setDescription(`**${displayName}** 님이 내전 참가자로 등록되었습니다.${riotInfo}`)
					.setColor(0x22a55a),
			],
		});
		return;
	}

	try {
		riot.parseRiotId(riotIdInput);
	} catch {
		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setTitle("⚠️ 등록 완료, 라이엇 ID 형식 오류")
					.setDescription(
						"디스코드 등록은 완료. 라이엇 ID는 `GameName#TagLine` 형식으로 다시 시도하세요.",
					)
					.setColor(0xe8b339),
			],
		});
		return;
	}

	try {
		const account = await riot.getAccountByRiotId(riotIdInput);
		await db.linkRiotAccount({
			userId: interaction.user.id,
			puuid: account.puuid,
			gameName: account.gameName,
			tagLine: account.tagLine,
			setMain: true,
		});
		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setTitle("✅ 등록 + 라이엇 연결 완료")
					.setDescription(
						`**${displayName}** · 라이엇 **${account.gameName}#${account.tagLine}** 메인 연결됨.`,
					)
					.setColor(0x22a55a),
			],
		});
	} catch (err) {
		const msg = err instanceof Error ? err.message : "알 수 없는 오류";
		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setTitle("⚠️ 등록 완료, 라이엇 연결 실패")
					.setDescription(
						`디스코드 등록 OK. 라이엇 서버에서 \`${riotIdInput}\` 를 찾지 못함 (${msg}).`,
					)
					.setColor(0xe8b339),
			],
		});
	}
}
