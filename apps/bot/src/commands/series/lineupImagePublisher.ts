import { balanceSvg } from "@mookbot/core";
import { AttachmentBuilder, type Client } from "discord.js";

const DEFAULT_LINEUP_CHANNEL_ID = "1500816168766804079";

export async function publishSeriesLineupImage(
	client: Client,
	seriesId: number,
	team1Side: "BLUE" | "RED" = "BLUE",
): Promise<string | null> {
	const channelId = process.env.ENTRY_LINEUP_CHANNEL_ID ?? DEFAULT_LINEUP_CHANNEL_ID;
	const svg = await balanceSvg.buildSeriesBalanceSvg(seriesId, team1Side);
	if (!svg) return `series ${seriesId} balance svg unavailable`;

	try {
		const ch = await client.channels.fetch(channelId);
		if (!ch?.isTextBased() || !("send" in ch)) {
			return `entry lineup channel ${channelId} is not a text channel`;
		}
		const attachment = new AttachmentBuilder(Buffer.from(svg, "utf8"), {
			name: `series-${seriesId}-lineup.svg`,
			description: `Series #${seriesId} lineup balance image`,
		});
		await ch.send({
			content: `📋 시리즈 #${seriesId} 엔트리 확정`,
			files: [attachment],
		});
		return null;
	} catch (err) {
		const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
		return `entry lineup image send 실패: ${detail}`;
	}
}
