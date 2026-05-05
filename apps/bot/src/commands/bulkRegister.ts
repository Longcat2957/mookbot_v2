import { db, riot } from "@mookbot/core";
import {
	type ChatInputCommandInteraction,
	type Collection,
	EmbedBuilder,
	type GuildMember,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from "discord.js";
import {
	countHashes,
	extractRiotIdFromDisplayName,
	formatRiotIdSuggestion,
} from "../utils/riotIdExtract.js";

export const data = new SlashCommandBuilder()
	.setName("일괄등록")
	.setDescription("(관리자) 서버 멤버 일괄 등록 + 별명 라이엇 ID 자동 연결")
	.addBooleanOption((o) => o.setName("dry_run").setDescription("DB 변경 없이 결과만 미리 확인"))
	.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

type Outcome =
	| { kind: "newlyLinked"; mention: string; displayName: string; gameName: string; tagLine: string }
	| { kind: "renamed"; mention: string; displayName: string; from: string; to: string }
	| {
			kind: "subAdded";
			mention: string;
			displayName: string;
			mainStays: string;
			subAdded: string;
	  }
	| { kind: "unchanged"; mention: string; displayName: string }
	| { kind: "ambiguous"; mention: string; displayName: string }
	| { kind: "noPattern"; mention: string; displayName: string }
	| { kind: "apiFailed"; mention: string; displayName: string; tried: string };

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({ content: "서버에서만 사용 가능", ephemeral: true });
		return;
	}
	if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
		await interaction.reply({
			content: "Manage Guild 권한 필요",
			ephemeral: true,
		});
		return;
	}

	const dryRun = interaction.options.getBoolean("dry_run") ?? false;
	await interaction.deferReply({ ephemeral: true });

	let allMembers: Collection<string, GuildMember>;
	try {
		allMembers = await interaction.guild.members.fetch();
	} catch (err) {
		const msg = err instanceof Error ? err.message : "알 수 없는 오류";
		await interaction.editReply({
			content: [
				"멤버 목록 fetch 실패.",
				"Discord Developer Portal → **Bot** → **Server Members Intent** ON 후 봇 재시작 필요.",
				`원본: \`${msg}\``,
			].join("\n"),
		});
		return;
	}

	const humans = [...allMembers.values()].filter((m) => !m.user.bot);
	if (humans.length === 0) {
		await interaction.editReply({ content: "처리할 멤버 없음" });
		return;
	}

	const buckets: Record<Outcome["kind"], Outcome[]> = {
		newlyLinked: [],
		renamed: [],
		subAdded: [],
		unchanged: [],
		ambiguous: [],
		noPattern: [],
		apiFailed: [],
	};

	for (const m of humans) {
		const o = await processMember(m, dryRun);
		buckets[o.kind].push(o);
	}

	const total = humans.length;
	const userOnly = buckets.ambiguous.length + buckets.noPattern.length + buckets.apiFailed.length;

	const eb = new EmbedBuilder()
		.setTitle(dryRun ? "🧪 일괄 등록 미리보기" : "✅ 일괄 등록 완료")
		.setDescription(
			[
				`총 멤버: **${total}명**`,
				`✅ 새로 연결: ${buckets.newlyLinked.length}명`,
				`🔄 닉 변경 감지: ${buckets.renamed.length}명`,
				`🆕 부계정 추가: ${buckets.subAdded.length}명`,
				`↩️ 변동 없음: ${buckets.unchanged.length}명`,
				`👤 users 만 (라이엇 미연결): ${userOnly}명`,
				dryRun ? "\n*dry_run=true — DB 변경 없음*" : "",
			]
				.filter(Boolean)
				.join("\n"),
		)
		.setColor(dryRun ? 0x5b6df2 : 0x22a55a);

	pushField(eb, "✅ 새로 연결", buckets.newlyLinked, (o) =>
		o.kind === "newlyLinked" ? `${o.mention} ${o.displayName} → \`${o.gameName}#${o.tagLine}\`` : "",
	);
	pushField(eb, "🔄 닉 변경", buckets.renamed, (o) =>
		o.kind === "renamed" ? `${o.mention} ${o.displayName} — \`${o.from}\` → \`${o.to}\`` : "",
	);
	pushField(eb, "🆕 부계정 추가", buckets.subAdded, (o) =>
		o.kind === "subAdded" ? `${o.mention} 메인: \`${o.mainStays}\`, 추가: \`${o.subAdded}\`` : "",
	);
	pushField(eb, "↩️ 변동 없음", buckets.unchanged, (o) => `${o.mention} ${o.displayName}`);
	pushField(eb, "⚠️ 모호 (# 2개 이상)", buckets.ambiguous, (o) => `${o.mention} ${o.displayName}`);
	pushField(eb, "📝 패턴 없음", buckets.noPattern, (o) => `${o.mention} ${o.displayName}`);
	pushField(eb, "❓ 라이엇 API 실패", buckets.apiFailed, (o) =>
		o.kind === "apiFailed" ? `${o.mention} (시도: \`${o.tried}\`)` : "",
	);

	await interaction.editReply({ embeds: [eb] });
}

function pushField(
	eb: EmbedBuilder,
	label: string,
	items: Outcome[],
	render: (o: Outcome) => string,
	max = 8,
): void {
	if (items.length === 0) return;
	const lines = items.slice(0, max).map((o) => `• ${render(o)}`);
	if (items.length > max) lines.push(`• ... 외 ${items.length - max}명`);
	let value = lines.join("\n");
	if (value.length > 1000) value = value.slice(0, 996) + "…";
	eb.addFields({ name: `${label} (${items.length})`, value });
}

async function processMember(member: GuildMember, dryRun: boolean): Promise<Outcome> {
	const userId = member.id;
	// GuildMember.displayName — 닉 → globalName → username chain (resolveGuildDisplayName 1순위와 동일)
	const displayName = member.displayName;
	const mention = `<@${userId}>`;

	if (!dryRun) await db.upsertUser(userId, displayName);

	if (countHashes(displayName) > 1) {
		return { kind: "ambiguous", mention, displayName };
	}

	const extracted = extractRiotIdFromDisplayName(displayName);
	const existingMain = await db.getMainRiotAccount(userId);

	if (!extracted) {
		return existingMain
			? { kind: "unchanged", mention, displayName }
			: { kind: "noPattern", mention, displayName };
	}

	if (
		existingMain &&
		existingMain.game_name.toLowerCase() === extracted.gameName.toLowerCase() &&
		existingMain.tag_line.toLowerCase() === extracted.tagLine.toLowerCase()
	) {
		return { kind: "unchanged", mention, displayName };
	}

	if (dryRun) {
		const tried = formatRiotIdSuggestion(extracted);
		if (!existingMain) {
			return {
				kind: "newlyLinked",
				mention,
				displayName,
				gameName: extracted.gameName,
				tagLine: extracted.tagLine,
			};
		}
		return {
			kind: "renamed",
			mention,
			displayName,
			from: `${existingMain.game_name}#${existingMain.tag_line}`,
			to: tried + " (dry-run)",
		};
	}

	let account: Awaited<ReturnType<typeof riot.getAccountByRiotId>>;
	try {
		account = await riot.getAccountByRiotId(formatRiotIdSuggestion(extracted));
	} catch {
		return {
			kind: "apiFailed",
			mention,
			displayName,
			tried: formatRiotIdSuggestion(extracted),
		};
	}

	// 소환사 아이콘 — Summoner API. 실패해도 등록 자체는 진행.
	let profileIconId: number | null = null;
	try {
		const s = await riot.getSummonerByPuuid(account.puuid);
		profileIconId = s.profileIconId;
	} catch {
		// rate limit / network — 다음 백필에서 채워짐
	}

	if (!existingMain) {
		await db.upsertRiotAccountIdentity({
			userId,
			puuid: account.puuid,
			gameName: account.gameName,
			tagLine: account.tagLine,
			profileIconId,
		});
		await db.setMainRiotAccount(userId, account.puuid);
		return {
			kind: "newlyLinked",
			mention,
			displayName,
			gameName: account.gameName,
			tagLine: account.tagLine,
		};
	}

	if (existingMain.puuid === account.puuid) {
		const sameIdentity =
			existingMain.game_name.toLowerCase() === account.gameName.toLowerCase() &&
			existingMain.tag_line.toLowerCase() === account.tagLine.toLowerCase();
		await db.upsertRiotAccountIdentity({
			userId,
			puuid: account.puuid,
			gameName: account.gameName,
			tagLine: account.tagLine,
			profileIconId,
		});
		if (sameIdentity) return { kind: "unchanged", mention, displayName };
		return {
			kind: "renamed",
			mention,
			displayName,
			from: `${existingMain.game_name}#${existingMain.tag_line}`,
			to: `${account.gameName}#${account.tagLine}`,
		};
	}

	const existingByPuuid = await db.getRiotAccountByPuuid(account.puuid);
	if (existingByPuuid && existingByPuuid.user_id === userId) {
		await db.upsertRiotAccountIdentity({
			userId,
			puuid: account.puuid,
			gameName: account.gameName,
			tagLine: account.tagLine,
			profileIconId,
		});
		return { kind: "unchanged", mention, displayName };
	}

	await db.upsertRiotAccountIdentity({
		userId,
		puuid: account.puuid,
		gameName: account.gameName,
		tagLine: account.tagLine,
		profileIconId,
	});
	return {
		kind: "subAdded",
		mention,
		displayName,
		mainStays: `${existingMain.game_name}#${existingMain.tag_line}`,
		subAdded: `${account.gameName}#${account.tagLine}`,
	};
}
