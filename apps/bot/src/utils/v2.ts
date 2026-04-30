import {
	ActionRowBuilder,
	type AttachmentBuilder,
	type ButtonBuilder,
	ContainerBuilder,
	MediaGalleryBuilder,
	MediaGalleryItemBuilder,
	MessageFlags,
	SectionBuilder,
	SeparatorBuilder,
	type StringSelectMenuBuilder,
	TextDisplayBuilder,
	ThumbnailBuilder,
} from "discord.js";

// ============================================================
// V2 Components 헬퍼
// 모든 사용자-facing 응답은 V2 Container 로 보냅니다 (utils/embeds.ts 의 V1
// EmbedBuilder 헬퍼는 점진 deprecate).
//
// 컴포넌트 카운트 cap 40 — Container(1) + 직접자식 + Section 내부(2/Section)
// + ActionRow 내부(button 수). 인터랙티브 화면 설계 시 카운트 추적 필수.
// ============================================================

export const COLORS = {
	success: 0x57f287,
	error: 0xed4245,
	warning: 0xfee75c,
	info: 0x5865f2,
	gold: 0xf4c874,
	gray: 0x4f545c,
} as const;

export type V2Reply = {
	flags: MessageFlags.IsComponentsV2;
	components: Array<ContainerBuilder | ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>>;
	files?: AttachmentBuilder[];
};

export type V2ContainerChild =
	| TextDisplayBuilder
	| SeparatorBuilder
	| SectionBuilder
	| MediaGalleryBuilder
	| ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>;

// ---------- 기본 빌더 ----------

export function v2Text(content: string): TextDisplayBuilder {
	return new TextDisplayBuilder().setContent(content);
}

export function v2Sep(): SeparatorBuilder {
	return new SeparatorBuilder();
}

export function v2Section(text: string, accessory: ButtonBuilder): SectionBuilder {
	return new SectionBuilder()
		.addTextDisplayComponents(v2Text(text))
		.setButtonAccessory(accessory);
}

/** Thumbnail accessory 가 우측에 붙는 Section — 챔피언 초상화 등에 사용. */
export function v2SectionThumb(text: string, imageUrl: string): SectionBuilder {
	return new SectionBuilder()
		.addTextDisplayComponents(v2Text(text))
		.setThumbnailAccessory(new ThumbnailBuilder().setURL(imageUrl));
}

export function v2Container(opts: {
	color?: number;
	children: V2ContainerChild[];
}): ContainerBuilder {
	const c = new ContainerBuilder();
	if (opts.color !== undefined) c.setAccentColor(opts.color);
	for (const child of opts.children) {
		if (child instanceof TextDisplayBuilder) c.addTextDisplayComponents(child);
		else if (child instanceof SeparatorBuilder) c.addSeparatorComponents(child);
		else if (child instanceof SectionBuilder) c.addSectionComponents(child);
		else if (child instanceof MediaGalleryBuilder) c.addMediaGalleryComponents(child);
		else c.addActionRowComponents(child);
	}
	return c;
}

/**
 * 챔피언 등 이미지 N장을 그리드로 — 각 item 은 url + description (hover tooltip).
 */
export function v2Gallery(items: Array<{ url: string; description?: string }>): MediaGalleryBuilder {
	const g = new MediaGalleryBuilder();
	for (const it of items) {
		const item = new MediaGalleryItemBuilder().setURL(it.url);
		if (it.description) item.setDescription(it.description);
		g.addItems(item);
	}
	return g;
}

// ---------- 임베드 등가 (단순 알림 박스) ----------

function simpleContainer(color: number, heading: string, body?: string): ContainerBuilder {
	const lines = [heading];
	if (body) lines.push(body);
	return v2Container({ color, children: [v2Text(lines.join("\n"))] });
}

export function v2Info(title: string, body?: string): ContainerBuilder {
	return simpleContainer(COLORS.info, `## ${title}`, body);
}

export function v2Success(title: string, body?: string): ContainerBuilder {
	return simpleContainer(COLORS.success, `## ✅ ${title}`, body);
}

export function v2Warn(title: string, body?: string): ContainerBuilder {
	return simpleContainer(COLORS.warning, `## ⚠️ ${title}`, body);
}

export function v2Error(message: string): ContainerBuilder {
	return simpleContainer(COLORS.error, "## ❌ 오류", message);
}

// ---------- 메시지 페이로드 빌더 ----------

export function v2Reply(
	...components: Array<ContainerBuilder | ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>>
): V2Reply {
	return {
		flags: MessageFlags.IsComponentsV2 as const,
		components,
	};
}

export function v2Ephemeral(
	...components: Array<ContainerBuilder | ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>>
) {
	return {
		flags: (MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral) as
			| MessageFlags.IsComponentsV2
			| MessageFlags.Ephemeral,
		components,
	};
}

// deferReply 용 — 이후 editReply 가 V2 components 를 받으려면 defer 시 V2 flag 필수.
// discord.js v14.26 의 InteractionDeferReplyOptions 타입은 V2 flag 를 노출 안 함 —
// 런타임 Discord API 는 지원하므로 캐스트로 우회.
export function v2DeferOpts(ephemeral = false): { flags: MessageFlags.Ephemeral } {
	const flags = ephemeral
		? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
		: MessageFlags.IsComponentsV2;
	return { flags } as unknown as { flags: MessageFlags.Ephemeral };
}

// editReply 용 — V2 플래그를 매번 명시 (defer 의 flag 가 transient 일 수 있어 안전판).
// InteractionEditReplyOptions.components 가 V2 builder 를 정확히 받지 못해 캐스트.
export function v2EditReply(
	...components: Array<ContainerBuilder | ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>>
): { components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] } {
	return { flags: MessageFlags.IsComponentsV2, components } as unknown as {
		components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
	};
}

// editReply + 파일 첨부 (PNG 이미지 등). attachment://filename 으로 컨테이너 안에서 참조 가능.
export function v2EditReplyWithFiles(
	files: AttachmentBuilder[],
	...components: Array<ContainerBuilder | ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>>
): {
	components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
	files: AttachmentBuilder[];
} {
	return { flags: MessageFlags.IsComponentsV2, components, files } as unknown as {
		components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
		files: AttachmentBuilder[];
	};
}

// ============================================================
// 시각화·이모지 매핑 (모던 미니멀)
// ============================================================

// 1.~ 등 순위 라벨 — 🥇🥈🥉 대체
export function rank(n: number): string {
	return `${n}.`;
}

// 변동값 — 📈/📉 대체. 굵게 + 부호.
export function delta(value: number, fractionDigits = 1): string {
	const sign = value >= 0 ? "+" : "";
	const arrow = value >= 0 ? "▲" : "▼";
	return `${arrow} **${sign}${value.toFixed(fractionDigits)}**`;
}

// MMR 변동 텍스트 막대 — 변동량을 시각화
// 결과 예: "1500 ━━━━▶ 1530  ▲ +30.0"
export function mmrBar(before: number, after: number): string {
	const b = Math.round(before);
	const a = Math.round(after);
	const d = after - before;
	const magnitude = Math.min(20, Math.max(2, Math.round(Math.abs(d) / 2)));
	const bar = "━".repeat(magnitude);
	const arrow = d >= 0 ? "▶" : "◀";
	return `\`${b}\` ${bar}${arrow} \`${a}\` ${delta(d)}`;
}
