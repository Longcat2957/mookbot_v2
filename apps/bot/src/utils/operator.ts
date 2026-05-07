// 운영자 권한 검증 — `BalanceTeam` 역할을 보유하면 운영자.
// 사용자가 다른 역할을 함께 가지고 있어도 BalanceTeam 만 있으면 통과.
//
// 역할 이름은 OPERATOR_ROLE_NAME env 로 override 가능 (기본 "BalanceTeam").
// 길드에서 해당 이름의 역할을 찾지 못하면 fail-secure 로 deny.

import { log } from "@mookbot/core";
import { type ButtonInteraction, type ChatInputCommandInteraction, GuildMember } from "discord.js";

type OpInteraction = ChatInputCommandInteraction | ButtonInteraction;

const DEFAULT_OPERATOR_ROLE_NAME = "BalanceTeam";

function operatorRoleName(): string {
	return process.env.OPERATOR_ROLE_NAME?.trim() || DEFAULT_OPERATOR_ROLE_NAME;
}

function memberRoleIds(interaction: OpInteraction): string[] {
	const m = interaction.member;
	if (!m) return [];
	if (m instanceof GuildMember) return [...m.roles.cache.keys()];
	if (Array.isArray((m as { roles?: unknown }).roles)) {
		return (m as { roles: string[] }).roles;
	}
	return [];
}

async function resolveOperatorRoleId(interaction: OpInteraction): Promise<string | null> {
	const name = operatorRoleName();
	const guild = interaction.guild;
	if (!guild) return null;
	const role =
		guild.roles.cache.find((r) => r.name === name) ??
		(await guild.roles.fetch().then((all) => all.find((r) => r.name === name) ?? null));
	return role?.id ?? null;
}

export async function isOperator(interaction: OpInteraction): Promise<boolean> {
	const roleId = await resolveOperatorRoleId(interaction);
	if (!roleId) {
		log.warn(
			{ roleName: operatorRoleName(), guildId: interaction.guild?.id },
			"operator: BalanceTeam role not found in guild — denying",
		);
		return false;
	}
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
