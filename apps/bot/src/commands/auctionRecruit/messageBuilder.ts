// 경매내전 모집 메시지 V2 빌더 + 메시지 갱신 폴백.
// 일반 모집과 분리 — 라인 선호 없음, 정원 10/20, [경매 시작] 버튼.

import { db } from "@mookbot/core";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type Client,
	type ContainerBuilder,
	MessageFlags,
	type RepliableInteraction,
	type StringSelectMenuBuilder,
} from "discord.js";
import { COLORS, v2Container, v2Sep, v2Text } from "../../utils/v2.js";

const { getAuctionRecruitment, listAuctionRecruitmentParticipants, setAuctionRecruitmentMessage } =
	db;

export async function renderComponents(
	id: number,
): Promise<Array<ContainerBuilder | ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>>> {
	const rec = await getAuctionRecruitment(id);
	if (!rec) throw new Error(`auction recruitment ${id} not found`);
	const participants = await listAuctionRecruitmentParticipants(id);
	const full = participants.length >= rec.target_count;

	const userIds = participants.map((p) => p.user_id);
	const users = userIds.length > 0 ? await db.listUsers(userIds) : [];
	const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));

	const formatLabel = rec.target_count === 20 ? "20인 (4팀 토너먼트)" : "10인 (1매치)";
	const statusBadge =
		rec.status === "CANCELLED"
			? "🛑 취소됨"
			: rec.status === "CLOSED"
				? "🟡 경매 진행 중 (Activity)"
				: rec.status === "CONVERTED"
					? "🟣 토너먼트 변환 완료"
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

	const rosterLines = participants.map((p, i) => {
		const name = nameById.get(p.user_id) ?? p.user_id;
		return `\`${String(i + 1).padStart(2, " ")}.\` **${name}**`;
	});

	const containerChildren = [
		v2Text(`## 🎟️ 경매내전 모집 #${rec.id}`),
		v2Text(
			`형식: **${formatLabel}** · 상태: **${statusBadge}** · 정원 **${participants.length} / ${rec.target_count}**`,
		),
		v2Sep(),
		v2Text(`### 참석자\n${rosterLines.length > 0 ? rosterLines.join("\n") : "_(아직 참석자 없음)_"}`),
	];

	if (rec.status === "OPEN") {
		containerChildren.push(
			v2Sep(),
			v2Text(
				full
					? "_▶ 운영자가 [경매 시작] 으로 Activity 진입. 또는 [모집 취소]._"
					: "_[참석] / [참석 취소]. 운영자가 멤버 직접 추가/제거하려면 `/경매내전모집인원추가` / `/경매내전모집인원삭제`. MMR 영향 없는 이벤트성 드래프트._",
			),
		);
	} else if (rec.status === "CLOSED") {
		containerChildren.push(
			v2Sep(),
			v2Text("_Activity 의 경매내전 화면에서 팀장 선출 → 포인트 배정 → 경매 → 매치 진행._"),
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

function buildOpenComponents(id: number, full: boolean): ActionRowBuilder<ButtonBuilder>[] {
	if (full) {
		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(`auctionRecruit:next:${id}`)
				.setLabel("▶ 경매 시작")
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setCustomId(`auctionRecruit:cancel:${id}`)
				.setLabel("모집 취소")
				.setStyle(ButtonStyle.Danger),
		);
		return [row];
	}

	const participantRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`auctionRecruit:join:${id}`)
			.setLabel("참석")
			.setStyle(ButtonStyle.Primary),
		new ButtonBuilder()
			.setCustomId(`auctionRecruit:leave:${id}`)
			.setLabel("참석 취소")
			.setStyle(ButtonStyle.Secondary),
	);

	const operatorRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`auctionRecruit:cancel:${id}`)
			.setLabel("모집 취소")
			.setStyle(ButtonStyle.Danger),
	);

	return [participantRow, operatorRow];
}

function buildClosedComponents(id: number): ActionRowBuilder<ButtonBuilder>[] {
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`auctionRecruit:cancel:${id}`)
			.setLabel("모집 취소")
			.setStyle(ButtonStyle.Danger),
	);
	return [row];
}

function isAccessOrMissingError(err: unknown): boolean {
	if (!(err instanceof Error)) return false;
	return (
		/50001|10008|50013/.test(err.message) ||
		/50001|10008|50013/.test(err.name) ||
		[50001, 10008, 50013].includes((err as { code?: number }).code ?? -1)
	);
}

/**
 * interaction 기반 메시지 갱신 — refreshRecruitMessage 와 동일 패턴.
 */
export async function refreshAuctionRecruitMessage(
	interaction: RepliableInteraction,
	id: number,
	channelId: string | null,
	messageId: string | null,
): Promise<string | null> {
	if (!channelId || !messageId) return "channel_id / message_id 추적 정보 없음";

	const components = await renderComponents(id);

	try {
		const ch = await interaction.client.channels.fetch(channelId);
		if (!ch || !ch.isTextBased() || !("messages" in ch)) {
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
				await setAuctionRecruitmentMessage(id, newMsg.channelId, newMsg.id);
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
 * client 만 가지고 메시지 갱신 — server-initiated 흐름.
 */
export async function refreshAuctionRecruitMessageWithClient(
	client: Client,
	id: number,
	channelId: string | null,
	messageId: string | null,
): Promise<string | null> {
	if (!channelId || !messageId) return "channel_id / message_id 추적 정보 없음";

	const components = await renderComponents(id);

	try {
		const ch = await client.channels.fetch(channelId);
		if (!ch || !ch.isTextBased() || !("messages" in ch)) {
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
				if (!ch || !ch.isTextBased() || !("send" in ch)) {
					return `${detail} (폴백 채널 접근 불가)`;
				}
				const newMsg = await ch.send({
					flags: MessageFlags.IsComponentsV2,
					components,
				} as Parameters<typeof ch.send>[0]);
				await setAuctionRecruitmentMessage(id, newMsg.channelId, newMsg.id);
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
