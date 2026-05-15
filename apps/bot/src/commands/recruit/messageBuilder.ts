// 모집 메시지 V2 컴포넌트 빌더 + 메시지 갱신 폴백 로직.

import { db } from "@mookbot/core";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type Client,
	type ContainerBuilder,
	MessageFlags,
	type RepliableInteraction,
	StringSelectMenuBuilder,
} from "discord.js";
import { COLORS, v2Container, v2Sep, v2Text } from "../../utils/v2.js";
import { ROLE_LABEL, ROLE_SLOTS, type RoleSlot } from "./types.js";

const { getRecruitment, listRecruitmentParticipants, setRecruitmentMessage } = db;

export async function renderComponents(
	id: number,
): Promise<Array<ContainerBuilder | ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>>> {
	const rec = await getRecruitment(id);
	if (!rec) throw new Error(`recruitment ${id} not found`);
	const participants = await listRecruitmentParticipants(id);
	const full = participants.length >= rec.target_count;

	// 표시 이름 fetch — Discord mention 깨짐 방지로 DB display_name 직접 표시
	const users = await db.listUsers(participants.map((p) => p.user_id));
	const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));

	const teamSize = rec.target_count / 2;
	const statusBadge =
		rec.status === "CANCELLED"
			? "🛑 취소됨"
			: rec.status === "CLOSED"
				? "🟡 엔트리 수정 중 (Activity)"
				: rec.status === "CONVERTED"
					? "🟣 시리즈 변환 완료"
					: full
						? "✅ 정원 도달"
						: "🟦 모집 중";
	const color =
		rec.status === "CANCELLED"
			? COLORS.gray
			: rec.status === "CLOSED"
				? COLORS.gold
				: rec.status === "CONVERTED"
					? COLORS.info
					: full
						? COLORS.success
						: COLORS.info;

	const rosterLines = renderRosterLines(participants, nameById);

	const containerChildren = [
		v2Text(`## 📣 ${teamSize}v${teamSize} 내전 모집 #${rec.id}`),
		v2Text(`상태: **${statusBadge}** · 정원 **${participants.length} / ${rec.target_count}**`),
		v2Sep(),
		v2Text(
			`### 참석자 (라인 선호)\n${rosterLines.length > 0 ? rosterLines.join("\n") : "_(아직 참석자 없음)_"}`,
		),
	];

	if (rec.status === "OPEN") {
		containerChildren.push(
			v2Sep(),
			v2Text(
				full
					? "_▶ 운영자가 [엔트리 수정 시작] 으로 Activity 진입. 또는 [모집 취소]._"
					: "_[참석] / [참석 취소] / 라인 선택. 운영자가 멤버를 직접 추가/제거하려면 `/내전인원추가` · `/내전인원삭제`._",
			),
		);
	} else if (rec.status === "CLOSED") {
		containerChildren.push(
			v2Sep(),
			v2Text("_운영자가 Activity 의 모집 목록에서 이 모집을 선택해 엔트리를 작성합니다._"),
		);
	}

	const out: Array<ContainerBuilder | ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>> = [
		v2Container({ color, children: containerChildren }),
	];

	if (rec.status === "OPEN") {
		out.push(...buildOpenComponents(id, full));
	} else if (rec.status === "CLOSED") {
		out.push(...buildClosedComponents(id));
	}

	return out;
}

function renderRosterLines(
	participants: { user_id: string; roles: RoleSlot[] }[],
	nameById: Map<string, string>,
): string[] {
	return participants.map((p, i) => {
		const roleStr =
			p.roles.length === 0 ? "_(라인 무관)_" : p.roles.map((r) => ROLE_LABEL[r]).join("/");
		const name = nameById.get(p.user_id) ?? p.user_id;
		return `\`${String(i + 1).padStart(2, " ")}.\` **${name}** · ${roleStr}`;
	});
}

function buildOpenComponents(
	id: number,
	full: boolean,
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
	if (full) {
		// 정원 도달 — 운영자에게 다음 단계만 노출. 참가자 액션은 의미 없으므로 hide.
		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(`recruit:next:${id}`)
				.setLabel("▶ 엔트리 수정 시작")
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setCustomId(`recruit:cancel:${id}`)
				.setLabel("모집 취소")
				.setStyle(ButtonStyle.Danger),
		);
		return [row];
	}

	// 정원 미달 — 일반 참가자 액션 + 라인 셀렉트 + 운영자 액션
	const participantRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`recruit:join:${id}`)
			.setLabel("참석")
			.setStyle(ButtonStyle.Primary),
		new ButtonBuilder()
			.setCustomId(`recruit:leave:${id}`)
			.setLabel("참석 취소")
			.setStyle(ButtonStyle.Secondary),
	);

	const operatorRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`recruit:cancel:${id}`)
			.setLabel("모집 취소")
			.setStyle(ButtonStyle.Danger),
	);

	const roleSelect = new StringSelectMenuBuilder()
		.setCustomId(`recruit:roles:${id}`)
		.setPlaceholder(`선호 라인 선택 (0~${ROLE_SLOTS.length}개, 무선택=라인 무관)`)
		.setMinValues(0)
		.setMaxValues(ROLE_SLOTS.length)
		.addOptions(
			ROLE_SLOTS.map((role) => ({
				label: ROLE_LABEL[role],
				value: role,
			})),
		);

	return [
		participantRow,
		new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleSelect),
		operatorRow,
	];
}

function buildClosedComponents(id: number): ActionRowBuilder<ButtonBuilder>[] {
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`recruit:cancel:${id}`)
			.setLabel("모집 취소")
			.setStyle(ButtonStyle.Danger),
	);
	return [row];
}

function isAccessOrMissingError(err: unknown): boolean {
	// DiscordAPIError 는 코드를 err.name (e.g. "DiscordAPIError[50001]"), err.message,
	// 또는 err.code 에 박음. 50001=Missing Access, 10008=Unknown Message, 50013=Missing Permissions
	if (!(err instanceof Error)) return false;
	return (
		/50001|10008|50013/.test(err.message) ||
		/50001|10008|50013/.test(err.name) ||
		[50001, 10008, 50013].includes((err as { code?: number }).code ?? -1)
	);
}

/**
 * 모집 메시지를 최신 상태로 갱신 — interaction 기반.
 *
 * 1차: channels.fetch + messages.edit (봇이 채널 읽기 권한 필요)
 * 2차 폴백: interaction.followUp 으로 새 메시지 게시 + tracking 갱신
 */
export async function refreshRecruitMessage(
	interaction: RepliableInteraction,
	id: number,
	channelId: string | null,
	messageId: string | null,
): Promise<string | null> {
	if (!channelId || !messageId) return "channel_id / message_id 추적 정보 없음";

	const components = await renderComponents(id);

	try {
		const ch = await interaction.client.channels.fetch(channelId);
		if (!ch?.isTextBased() || !("messages" in ch)) {
			return "채널 접근 불가";
		}
		const msg = await ch.messages.fetch(messageId);
		await msg.edit({
			flags: MessageFlags.IsComponentsV2,
			components,
		} as Parameters<typeof msg.edit>[0]);
		return null;
	} catch (err) {
		const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
		if (isAccessOrMissingError(err)) {
			try {
				const newMsg = await interaction.followUp({
					flags: MessageFlags.IsComponentsV2,
					components,
				} as Parameters<typeof interaction.followUp>[0]);
				await setRecruitmentMessage(id, newMsg.channelId, newMsg.id);
				return null;
			} catch (followErr) {
				const followDetail =
					followErr instanceof Error ? `${followErr.name}: ${followErr.message}` : String(followErr);
				return `${detail} (followUp 도 실패: ${followDetail})`;
			}
		}
		return detail;
	}
}

/**
 * client 만 가지고 모집 메시지 갱신 — api → bot HTTP refresh 같은 server-initiated
 * 흐름에서 사용. interaction 컨텍스트가 없어서 폴백은 channel.send 로 직접 새 메시지 게시.
 */
export async function refreshRecruitMessageWithClient(
	client: Client,
	id: number,
	channelId: string | null,
	messageId: string | null,
): Promise<string | null> {
	if (!channelId || !messageId) return "channel_id / message_id 추적 정보 없음";

	const components = await renderComponents(id);

	try {
		const ch = await client.channels.fetch(channelId);
		if (!ch?.isTextBased() || !("messages" in ch)) {
			return "채널 접근 불가";
		}
		const msg = await ch.messages.fetch(messageId);
		await msg.edit({
			flags: MessageFlags.IsComponentsV2,
			components,
		} as Parameters<typeof msg.edit>[0]);
		return null;
	} catch (err) {
		const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
		if (isAccessOrMissingError(err)) {
			try {
				const ch = await client.channels.fetch(channelId);
				if (!ch?.isTextBased() || !("send" in ch)) {
					return `${detail} (폴백 채널 접근 불가)`;
				}
				const newMsg = await ch.send({
					flags: MessageFlags.IsComponentsV2,
					components,
				} as Parameters<typeof ch.send>[0]);
				await setRecruitmentMessage(id, newMsg.channelId, newMsg.id);
				return null;
			} catch (followErr) {
				const followDetail =
					followErr instanceof Error ? `${followErr.name}: ${followErr.message}` : String(followErr);
				return `${detail} (channel.send 폴백 실패: ${followDetail})`;
			}
		}
		return detail;
	}
}
