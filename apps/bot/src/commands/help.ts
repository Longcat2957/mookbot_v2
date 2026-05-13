// /도움말 — 모든 슬래시 명령어 분류별 목록.
// 사용자에겐 자기 권한에 해당하는 것만 표시 (운영자는 [운영자] 섹션도 노출).
// 명령어 이름이 바뀔 때 이 파일도 같이 갱신해야 함 (single source of truth).

import { type ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { isOperator } from "../utils/operator.js";

export const data = new SlashCommandBuilder()
	.setName("도움말")
	.setDescription("사용 가능한 슬래시 명령어 목록")
	.addStringOption((o) =>
		o
			.setName("분류")
			.setDescription("특정 분류만 보기 (미지정 시 전체)")
			.addChoices(
				{ name: "사용자", value: "user" },
				{ name: "내전 (RANKED)", value: "ranked" },
				{ name: "경매내전 (AUCTION)", value: "auction" },
				{ name: "운영자", value: "admin" },
			),
	);

interface CommandEntry {
	name: string;
	desc: string;
}

const USER_COMMANDS: CommandEntry[] = [
	{ name: "/등록 riot_id:<게임명#태그>", desc: "내전 참가자로 등록 (라이엇 ID 연결은 선택)" },
	{ name: "/내정보", desc: "내 등록 정보 + 시즌 라인별 MMR" },
	{ name: "/내정보갱신", desc: "라이엇 소환사 아이콘 다시 동기화" },
	{ name: "/내전기록 [유저] [시즌]", desc: "라인별 통계 + 최근 MMR 변동" },
	{ name: "/랭킹 [라인] [시즌]", desc: "라인별 시즌 MMR 상위 10" },
	{ name: "/전적 riot_id:<게임명#태그>", desc: "라이엇 솔로/자유 랭크 + 챔피언 마스터리 top 5" },
	{ name: "/지금게임 riot_id:<게임명#태그>", desc: "현재 라이브 게임 (Spectator) 조회" },
];

const RANKED_COMMANDS: CommandEntry[] = [
	{ name: "/내전모집 정원:<2~10>", desc: "일반 내전 참가자 모집 시작" },
];

const RANKED_ADMIN_COMMANDS: CommandEntry[] = [
	{ name: "/내전인원추가 모집:<id> 멤버:@user", desc: "[운영자] 모집에 멤버 강제 추가" },
	{ name: "/내전인원삭제 모집:<id> 멤버:@user", desc: "[운영자] 모집에서 멤버 강제 제거" },
	{
		name: "/내전랜덤인원추가 모집:<id> 인원:<n>",
		desc: "[운영자] 테스트용 — 랜덤 등록 사용자 N명 추가",
	},
	{ name: "/내전모집삭제 모집:<id>", desc: "[운영자] 모집 (OPEN/CLOSED/CANCELLED) 물리 삭제" },
	{ name: "/내전목록 [상태] [시즌] [limit]", desc: "[운영자] 최근 시리즈 목록" },
	{
		name: "/내전강제삭제 series_id:<id> [rollback_mmr]",
		desc: "[운영자] 시리즈 + 종속 데이터 삭제 (선택적 MMR 롤백)",
	},
	{
		name: "/내전조기종료 시리즈:<id> 결과:<1팀승/2팀승/취소>",
		desc: "[운영자] 진행중 시리즈 강제 종료 (MMR 보존)",
	},
];

const AUCTION_COMMANDS: CommandEntry[] = [
	{ name: "/경매모집 정원:<10|20>", desc: "경매내전 (이벤트성, MMR 영향 없음) 모집 시작" },
];

const AUCTION_ADMIN_COMMANDS: CommandEntry[] = [
	{ name: "/경매인원추가 모집:<id> 멤버:@user", desc: "[운영자] 경매 모집에 멤버 강제 추가" },
	{ name: "/경매인원삭제 모집:<id> 멤버:@user", desc: "[운영자] 경매 모집에서 멤버 강제 제거" },
	{ name: "/경매목록 [상태] [시즌] [limit]", desc: "[운영자] 최근 경매내전 토너먼트 목록" },
	{ name: "/경매강제삭제 모집:<id>", desc: "[운영자] 경매 모집 + 토너먼트 응급 강제 삭제" },
	{
		name: "/경매조기종료 토너먼트:<id>",
		desc: "[운영자] 진행중 토너먼트 graceful 취소 (historical 보존)",
	},
];

const OPERATOR_GLOBAL_COMMANDS: CommandEntry[] = [
	{ name: "/일괄등록", desc: "[관리자] 서버 멤버 일괄 등록 + 별명 라이엇 ID 자동 연결" },
	{
		name: "/MMR수정 user:@user role:<라인> delta:<±n> [note]",
		desc: "[운영자] 특정 사용자 라인 MMR 수동 보정",
	},
	{ name: "/시즌결과리셋 시즌:<id>", desc: "[운영자] 시즌의 모든 RANKED/AUCTION 데이터 정리" },
	{ name: "/오래된내전정리 [days]", desc: "[운영자] 방치된 모집/시리즈/경매 일괄 정리" },
	{ name: "/로그", desc: "[운영자] audit 로그 웹뷰 링크 받기" },
];

function renderSection(title: string, emoji: string, cmds: CommandEntry[]): string {
	const lines = cmds.map((c) => `\`${c.name}\` — ${c.desc}`).join("\n");
	return `${emoji} **${title}**\n${lines}`;
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	const filter = interaction.options.getString("분류");
	const op = await isOperator(interaction);

	const sections: string[] = [];

	const show = (k: "user" | "ranked" | "auction" | "admin"): boolean =>
		filter === null || filter === k;

	if (show("user")) {
		sections.push(renderSection("사용자", "👤", USER_COMMANDS));
	}
	if (show("ranked")) {
		const ranked = [...RANKED_COMMANDS, ...(op ? RANKED_ADMIN_COMMANDS : [])];
		if (ranked.length > 0) sections.push(renderSection("내전 (RANKED)", "🎮", ranked));
	}
	if (show("auction")) {
		const auction = [...AUCTION_COMMANDS, ...(op ? AUCTION_ADMIN_COMMANDS : [])];
		if (auction.length > 0) sections.push(renderSection("경매내전 (AUCTION)", "🎟️", auction));
	}
	if (show("admin") && op) {
		sections.push(renderSection("운영자 (공통)", "⚙️", OPERATOR_GLOBAL_COMMANDS));
	}

	if (sections.length === 0) {
		await interaction.reply({
			content: "표시할 명령어가 없습니다.",
			ephemeral: true,
		});
		return;
	}

	const embed = new EmbedBuilder()
		.setTitle("📖 명령어 도움말")
		.setColor(0x5865f2)
		.setDescription(sections.join("\n\n"))
		.setFooter({
			text: op ? "운영자 권한 감지됨 — 모든 명령어 표시" : "[운영자] 표시 명령은 운영자 권한 필요",
		});

	await interaction.reply({ embeds: [embed], ephemeral: true });
}
