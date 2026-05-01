import {
	type ChatInputCommandInteraction,
	GuildMember,
	type ButtonInteraction,
} from "discord.js";

type OpInteraction = ChatInputCommandInteraction | ButtonInteraction;

function memberRoleIds(interaction: OpInteraction): string[] {
	const m = interaction.member;
	if (!m) return [];
	if (m instanceof GuildMember) return [...m.roles.cache.keys()];
	if (Array.isArray((m as { roles?: unknown }).roles)) {
		return (m as { roles: string[] }).roles;
	}
	return [];
}

async function resolveOperatorRoleId(
	interaction: OpInteraction,
): Promise<string | null> {
	const id = process.env.OPERATOR_ROLE_ID?.trim();
	if (id) return id;
	const name = process.env.OPERATOR_ROLE_NAME?.trim();
	if (!name) return null;
	const guild = interaction.guild;
	if (!guild) return null;
	const role = guild.roles.cache.find((r) => r.name === name)
		?? (await guild.roles.fetch().then((all) => all.find((r) => r.name === name) ?? null));
	return role?.id ?? null;
}

export async function isOperator(interaction: OpInteraction): Promise<boolean> {
	const roleId = await resolveOperatorRoleId(interaction);
	if (!roleId) return true;
	return memberRoleIds(interaction).includes(roleId);
}

export async function requireOperator(interaction: OpInteraction): Promise<boolean> {
	if (await isOperator(interaction)) return true;
	const reply = {
		content: "⛔ 운영자 권한이 필요합니다.",
		ephemeral: true,
	} as const;
	if (interaction.replied || interaction.deferred) {
		await interaction.followUp(reply).catch(() => undefined);
	} else {
		await interaction.reply(reply).catch(() => undefined);
	}
	return false;
}
