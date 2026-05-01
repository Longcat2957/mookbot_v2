// 모집 메시지의 버튼 인터랙션 처리 — 참여/취소/멤버관리/엔트리 진입.

import { db } from "@mookbot/core";
import { ActionRowBuilder, type ButtonInteraction, StringSelectMenuBuilder } from "discord.js";
import { notify } from "../../utils/notify.js";
import { v2EditReply } from "../../utils/v2.js";
import { renderComponents } from "./messageBuilder.js";

const {
	getRecruitment,
	setRecruitmentStatus,
	addRecruitmentParticipant,
	removeRecruitmentParticipant,
	listRecruitmentParticipants,
	isRecruitmentParticipant,
	upsertUser,
} = db;

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

// Discord StringSelect: 25 옵션/메뉴, 5 메뉴/메시지 → 한 ephemeral reply 에 최대 125명.
// UserSelectMenu 는 운영자 클라이언트 캐시 의존이라 일부만 보였음 — 봇이 길드 멤버를 직접
// fetch 해서 옵션을 박아 렌더하면 캐시와 무관하게 항상 전체 표시.
const ADDUSER_PAGE_SIZE = 25;
const ADDUSER_MAX_PAGES = 5;

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
	if (!interaction.guild) {
		await interaction.reply({ content: "길드 컨텍스트 없음.", ephemeral: true });
		return;
	}

	await interaction.deferReply({ ephemeral: true });

	const [current, members] = await Promise.all([
		listRecruitmentParticipants(id),
		interaction.guild.members.fetch(),
	]);
	const currentIds = new Set(current.map((p) => p.user_id));

	const candidates = [...members.values()]
		.filter((m) => !m.user.bot)
		.sort((a, b) => a.displayName.localeCompare(b.displayName, "ko"));

	const cap = ADDUSER_PAGE_SIZE * ADDUSER_MAX_PAGES;
	const visible = candidates.slice(0, cap);
	const truncated = candidates.length > cap;

	const chunks: (typeof visible)[] = [];
	for (let i = 0; i < visible.length; i += ADDUSER_PAGE_SIZE) {
		chunks.push(visible.slice(i, i + ADDUSER_PAGE_SIZE));
	}

	const rows = chunks.map((chunk, page) => {
		const select = new StringSelectMenuBuilder()
			.setCustomId(`recruit:adduser_select:${id}:${page}`)
			.setPlaceholder(`멤버 선택 ${page + 1}/${chunks.length}`)
			.setMinValues(0)
			.setMaxValues(chunk.length)
			.addOptions(
				chunk.map((m) => ({
					label: m.displayName.slice(0, 100),
					value: m.id,
					default: currentIds.has(m.id),
				})),
			);
		return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
	});

	const lines = [
		`### +/- 멤버 관리 — 모집 #${id}`,
		`현재 풀 **${currentIds.size}/${targetCount}**.`,
		"_각 페이지에서 풀에 있어야 할 멤버를 체크 — 다른 페이지 멤버 상태는 유지됩니다._",
		"_⚠️ 새로 추가된 멤버는 라인 무관 상태. 본인이 라인 선호 셀렉트로 변경 가능._",
	];
	if (truncated) {
		lines.push(`_⚠️ 길드 멤버 ${candidates.length}명 중 ${cap}명만 표시 (가나다순)_`);
	}

	await interaction.editReply({
		content: lines.join("\n"),
		components: rows,
	});
}
