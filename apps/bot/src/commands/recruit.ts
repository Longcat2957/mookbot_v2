import { db } from "@mookbot/core";
import {
	ActionRowBuilder,
	ApplicationIntegrationType,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type ChatInputCommandInteraction,
	type ContainerBuilder,
	InteractionContextType,
	MessageFlags,
	SlashCommandBuilder,
	StringSelectMenuBuilder,
	type StringSelectMenuInteraction,
	UserSelectMenuBuilder,
	type UserSelectMenuInteraction,
} from "discord.js";
import { notify } from "../utils/notify.js";
import {
	COLORS,
	v2Container,
	v2EditReply,
	v2Ephemeral,
	v2Error,
	v2Reply,
	v2Sep,
	v2Text,
} from "../utils/v2.js";

const {
	createRecruitment,
	getRecruitment,
	setRecruitmentMessage,
	setRecruitmentStatus,
	addRecruitmentParticipant,
	removeRecruitmentParticipant,
	listRecruitmentParticipants,
	isRecruitmentParticipant,
	setRecruitmentRoles,
	upsertUser,
	getCurrentSeason,
	createSeason,
	ROLE_SLOTS,
} = db;

type RoleSlot = (typeof ROLE_SLOTS)[number];

const ROLE_LABEL: Record<RoleSlot, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};

export const data = new SlashCommandBuilder()
	.setName("내전모집")
	.setDescription("내전 참가자를 모집합니다.")
	// Guild Install + Guild context 만 허용 — User Install context 면 응답이 ephemeral 처리됨
	.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
	.setContexts(InteractionContextType.Guild)
	.addIntegerOption((o) =>
		o
			.setName("정원")
			.setDescription("총 인원 (2/4/6/8/10)")
			.addChoices(
				{ name: "1v1 (2명)", value: 2 },
				{ name: "2v2 (4명)", value: 4 },
				{ name: "3v3 (6명)", value: 6 },
				{ name: "4v4 (8명)", value: 8 },
				{ name: "5v5 (10명)", value: 10 },
			)
			.setRequired(true),
	);

async function ensureSeasonId(): Promise<number> {
	const cur = await getCurrentSeason();
	if (cur) return cur.id;
	const created = await createSeason("Season 1");
	return created.id;
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.inGuild()) {
		await interaction.reply(v2Ephemeral(v2Error("서버에서만 사용 가능합니다.")));
		return;
	}
	const targetCount = interaction.options.getInteger("정원", true);

	await upsertUser(interaction.user.id, interaction.user.displayName);
	const seasonId = await ensureSeasonId();

	const rec = await createRecruitment({
		seasonId,
		targetCount,
		createdBy: interaction.user.id,
	});

	const components = await renderComponents(rec.id);
	await interaction.reply(v2Reply(...components));
	const msg = await interaction.fetchReply();
	await setRecruitmentMessage(rec.id, msg.channelId, msg.id);
}

// ======================================================================
// Button handlers
// ======================================================================

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
	const [, action, idStr] = interaction.customId.split(":");
	const id = Number(idStr);
	if (!id) {
		await interaction.reply({ content: "잘못된 모집 ID", ephemeral: true });
		return;
	}
	const rec = await getRecruitment(id);
	if (!rec) {
		await interaction.reply({ content: "모집을 찾을 수 없습니다.", ephemeral: true });
		return;
	}
	const isOpen = rec.status === "OPEN";
	const isClosed = rec.status === "CLOSED";

	// 참가자 액션은 OPEN 일 때만
	const participantActions = new Set<string | undefined>(["join", "leave"]);
	if (participantActions.has(action) && !isOpen) {
		await interaction.reply({ content: `모집이 ${rec.status} 상태입니다.`, ephemeral: true });
		return;
	}
	// 운영자 액션은 OPEN/CLOSED 모두 허용 (취소·멤버 관리 사후 가능)
	if (!isOpen && !isClosed) {
		await interaction.reply({ content: `모집이 ${rec.status} 상태입니다.`, ephemeral: true });
		return;
	}

	await upsertUser(interaction.user.id, interaction.user.displayName);

	switch (action) {
		case "join":
			return await handleJoin(interaction, id, rec.target_count);
		case "leave":
			return await handleLeave(interaction, id);
		case "adduser":
			return await openAdminUserSelect(interaction, id, rec.created_by, rec.target_count);
		case "cancel":
			return await handleCancel(interaction, id, rec.created_by);
		case "next":
			if (!isOpen) {
				await interaction.reply({
					content: "이미 엔트리 수정 단계로 진입한 모집입니다.",
					ephemeral: true,
				});
				return;
			}
			return await handleNext(interaction, id, rec.created_by);
		default:
			await interaction.reply({ content: `알 수 없는 액션: ${action}`, ephemeral: true });
	}
}

async function handleJoin(
	interaction: ButtonInteraction,
	id: number,
	target: number,
): Promise<void> {
	const already = await isRecruitmentParticipant(id, interaction.user.id);
	if (already) {
		await interaction.reply({ content: "이미 참석 등록되어 있습니다.", ephemeral: true });
		return;
	}
	const participants = await listRecruitmentParticipants(id);
	if (participants.length >= target) {
		await interaction.reply({ content: "정원이 가득 찼습니다.", ephemeral: true });
		return;
	}
	// 디스코드 3초 ack 윈도우 회피 — 무거운 D1 쿼리 전 deferUpdate 로 먼저 응답
	await interaction.deferUpdate();
	// 참가자가 길드 멤버이면 닉네임으로 갱신 (User.displayName 은 글로벌 이름이라 부정확)
	const memberName = await fetchGuildMemberName(interaction);
	await upsertUser(interaction.user.id, memberName);
	await addRecruitmentParticipant({ recruitmentId: id, userId: interaction.user.id });
	const components = await renderComponents(id);
	await interaction.editReply(v2EditReply(...components));
	void notify(`recruitment:${id}`);
	void notify("dashboard");
}

async function handleLeave(interaction: ButtonInteraction, id: number): Promise<void> {
	const already = await isRecruitmentParticipant(id, interaction.user.id);
	if (!already) {
		await interaction.reply({ content: "참석하지 않은 상태입니다.", ephemeral: true });
		return;
	}
	await interaction.deferUpdate();
	await removeRecruitmentParticipant(id, interaction.user.id);
	const components = await renderComponents(id);
	await interaction.editReply(v2EditReply(...components));
	void notify(`recruitment:${id}`);
	void notify("dashboard");
}

async function fetchGuildMemberName(interaction: ButtonInteraction): Promise<string> {
	if (!interaction.guild) {
		return interaction.user.displayName ?? interaction.user.username;
	}
	const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
	return member?.displayName ?? interaction.user.displayName ?? interaction.user.username;
}

async function handleCancel(
	interaction: ButtonInteraction,
	id: number,
	createdBy: string,
): Promise<void> {
	if (interaction.user.id !== createdBy) {
		await interaction.reply({
			content: "모집을 취소할 수 있는 건 모집을 만든 운영자뿐입니다.",
			ephemeral: true,
		});
		return;
	}
	await interaction.deferUpdate();
	await setRecruitmentStatus(id, "CANCELLED");
	const components = await renderComponents(id);
	await interaction.editReply(v2EditReply(...components));
	void notify(`recruitment:${id}`);
	void notify("dashboard");
}

async function handleNext(
	interaction: ButtonInteraction,
	id: number,
	createdBy: string,
): Promise<void> {
	if (interaction.user.id !== createdBy) {
		await interaction.reply({
			content: "엔트리 수정 시작은 모집을 만든 운영자만 가능합니다.",
			ephemeral: true,
		});
		return;
	}
	const participants = await listRecruitmentParticipants(id);
	const rec = await getRecruitment(id);
	if (!rec) return;
	if (participants.length < rec.target_count) {
		await interaction.reply({
			content: `정원 미달 (${participants.length}/${rec.target_count}). 멤버 관리로 채우세요.`,
			ephemeral: true,
		});
		return;
	}
	// 모집 → CLOSED 전이. Activity 가 CLOSED 모집 리스트를 보여주고
	// 운영자가 클릭 시 엔트리 수정 화면으로 이동.
	// deferUpdate 로 3초 ack 회피 — 그 다음 D1 작업 + 메시지 갱신.
	await interaction.deferUpdate();
	await setRecruitmentStatus(id, "CLOSED");
	const components = await renderComponents(id);
	await interaction.editReply(v2EditReply(...components));
	void notify(`recruitment:${id}`);
	void notify("dashboard");
	await interaction.followUp({
		content: [
			`### ▶ 엔트리 수정 시작 — 모집 #${id} 마감`,
			"보이스 채널에서 **Activity** 를 시작한 뒤 **mookbot** 을 선택하세요.",
			"Activity 첫 화면에 마감된 모집 목록이 표시되며, 클릭하면 엔트리 수정 화면이 열립니다.",
		].join("\n"),
		ephemeral: true,
	});
}

async function openAdminUserSelect(
	interaction: ButtonInteraction,
	id: number,
	createdBy: string,
	targetCount: number,
): Promise<void> {
	if (interaction.user.id !== createdBy) {
		await interaction.reply({
			content: "멤버 관리는 모집을 만든 운영자만 가능합니다.",
			ephemeral: true,
		});
		return;
	}
	const current = await listRecruitmentParticipants(id);
	const currentIds = current.map((p) => p.user_id);
	const maxValues = Math.min(25, Math.max(targetCount, currentIds.length));

	const userSelect = new UserSelectMenuBuilder()
		.setCustomId(`recruit:adduser_select:${id}`)
		.setPlaceholder(`풀 멤버 (현재 ${currentIds.length}/${targetCount})`)
		.setMinValues(0)
		.setMaxValues(maxValues);
	if (currentIds.length > 0) userSelect.setDefaultUsers(...currentIds.slice(0, 25));

	await interaction.reply({
		content: [
			`### +/- 멤버 관리 — 모집 #${id}`,
			`현재 풀 **${currentIds.length}/${targetCount}**.`,
			"_셀렉트 결과가 새 풀 상태가 됩니다 — 추가는 선택, 제거는 해제._",
			"_⚠️ 새로 추가된 멤버는 라인 무관 상태. 본인이 라인 선호 셀렉트로 변경 가능._",
		].join("\n"),
		components: [new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect)],
		ephemeral: true,
	});
}

// ======================================================================
// Select handlers
// ======================================================================

export async function handleStringSelect(interaction: StringSelectMenuInteraction): Promise<void> {
	const [, action, idStr] = interaction.customId.split(":");
	if (action !== "roles") return;

	const id = Number(idStr);
	const rec = await getRecruitment(id);
	if (!rec || rec.status !== "OPEN") {
		await interaction.reply({
			content: "이 모집은 더 이상 열려있지 않습니다.",
			ephemeral: true,
		});
		return;
	}

	const roles = interaction.values as RoleSlot[];
	await upsertUser(interaction.user.id, interaction.user.displayName);

	// 비참가자가 라인 선택 → 자동으로 참가 처리
	const already = await isRecruitmentParticipant(id, interaction.user.id);
	if (!already) {
		const participants = await listRecruitmentParticipants(id);
		if (participants.length >= rec.target_count) {
			await interaction.reply({ content: "정원이 가득 찼습니다.", ephemeral: true });
			return;
		}
		await addRecruitmentParticipant({ recruitmentId: id, userId: interaction.user.id });
	}

	await setRecruitmentRoles(id, interaction.user.id, roles);
	await interaction.update(v2EditReply(...(await renderComponents(id))));
	void notify(`recruitment:${id}`);
	void notify("dashboard");
}

export async function handleUserSelect(interaction: UserSelectMenuInteraction): Promise<void> {
	const [, action, idStr] = interaction.customId.split(":");
	if (action !== "adduser_select") return;

	const id = Number(idStr);
	const rec = await getRecruitment(id);
	if (!rec || rec.status !== "OPEN") {
		await interaction.reply({
			content: "이 모집은 더 이상 열려있지 않습니다.",
			ephemeral: true,
		});
		return;
	}
	if (interaction.user.id !== rec.created_by) {
		await interaction.reply({
			content: "운영자만 가능합니다.",
			ephemeral: true,
		});
		return;
	}

	await interaction.deferReply({ ephemeral: true });

	const targetSet = new Set<string>(interaction.values);
	const currentList = await listRecruitmentParticipants(id);
	const currentSet = new Set(currentList.map((p) => p.user_id));

	const toAddIds = [...targetSet].filter((uid) => !currentSet.has(uid));
	const toRemoveIds = [...currentSet].filter((uid) => !targetSet.has(uid));

	const newSize = currentSet.size - toRemoveIds.length + toAddIds.length;
	const overflow = Math.max(0, newSize - rec.target_count);
	const cappedAddIds = overflow > 0 ? toAddIds.slice(0, toAddIds.length - overflow) : toAddIds;
	const skipped = toAddIds.slice(cappedAddIds.length);

	const added: string[] = [];
	const removed: string[] = [];

	for (const userId of cappedAddIds) {
		let displayName = userId;
		if (interaction.guild) {
			const m = await interaction.guild.members.fetch(userId).catch(() => null);
			if (m) displayName = m.displayName;
		}
		await upsertUser(userId, displayName);
		await addRecruitmentParticipant({ recruitmentId: id, userId });
		await setRecruitmentRoles(id, userId, []);
		added.push(displayName);
	}

	for (const userId of toRemoveIds) {
		await removeRecruitmentParticipant(id, userId);
		removed.push(`<@${userId}>`);
	}

	// 모집 메시지 갱신
	let refreshError: string | null = null;
	if (added.length > 0 || removed.length > 0) {
		refreshError = await refreshRecruitMessage(interaction, id, rec.channel_id, rec.message_id);
		void notify(`recruitment:${id}`);
		void notify("dashboard");
	}

	const lines = [`### 멤버 관리 — 모집 #${id}`];
	if (added.length > 0) lines.push(`✅ 추가 (${added.length}): ${added.join(", ")}`);
	if (removed.length > 0) lines.push(`✗ 제거 (${removed.length}): ${removed.join(", ")}`);
	if (skipped.length > 0) lines.push(`⚠️ 정원 초과로 ${skipped.length}명 건너뜀`);
	if (added.length === 0 && removed.length === 0) lines.push("_변경 없음._");
	if (refreshError) {
		lines.push("", `⚠️ 모집 메시지 갱신 실패: \`${refreshError}\``);
	}

	await interaction.editReply({ content: lines.join("\n") });
}

/**
 * 모집 메시지를 최신 상태로 갱신. 실패 사유를 문자열로 반환 (성공 시 null).
 *
 * 1차: channels.fetch + messages.edit (봇이 채널 읽기 권한 필요)
 * 2차 폴백: interaction.followUp 으로 새 메시지 게시 + tracking 갱신
 */
async function refreshRecruitMessage(
	interaction: UserSelectMenuInteraction,
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
		// access / missing 케이스 → followUp 으로 새 메시지 게시 + tracking 갱신
		// DiscordAPIError 는 코드를 err.name (e.g. "DiscordAPIError[50001]") 또는 err.code 에 박음
		const isAccessOrMissing =
			err instanceof Error &&
			(/50001|10008|50013/.test(err.message) ||
				/50001|10008|50013/.test(err.name) ||
				[50001, 10008, 50013].includes((err as { code?: number }).code ?? -1));
		if (isAccessOrMissing) {
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

// ======================================================================
// Render
// ======================================================================

async function renderComponents(
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
					: "_[참석] / [참석 취소] / 라인 선택. 운영자: [+ 멤버 관리] / [모집 취소]._",
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
				.setCustomId(`recruit:adduser:${id}`)
				.setLabel("+ 멤버 관리")
				.setStyle(ButtonStyle.Secondary),
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
			.setCustomId(`recruit:adduser:${id}`)
			.setLabel("+ 멤버 관리")
			.setStyle(ButtonStyle.Secondary),
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
			.setCustomId(`recruit:adduser:${id}`)
			.setLabel("+ 멤버 관리")
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId(`recruit:cancel:${id}`)
			.setLabel("모집 취소")
			.setStyle(ButtonStyle.Danger),
	);
	return [row];
}
