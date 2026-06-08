import * as db from "./db/index.js";

export type BalanceSide = "BLUE" | "RED";
type Role = "TOP" | "JUNGLE" | "MID" | "BOTTOM" | "SUPPORT";

const ROLE_ORDER: Role[] = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"];
const ROLE_LABEL: Record<Role, string> = {
	TOP: "TOP",
	JUNGLE: "JNG",
	MID: "MID",
	BOTTOM: "BOT",
	SUPPORT: "SUP",
};

export async function buildSeriesBalanceSvg(seriesId: number, side: BalanceSide = "BLUE") {
	const series = await db.getSeries(seriesId);
	if (!series) return null;

	const team1Side: BalanceSide = side;
	const team2Side: BalanceSide = side === "BLUE" ? "RED" : "BLUE";

	const parts = await db.getSeriesParticipants(seriesId);
	const users = await db.listUsers(parts.map((p) => p.user_id));
	const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));

	const mmrPairs = parts.map((p) => ({ userId: p.user_id, role: p.role }));
	const mmrRows = await db.getLaneMmrs(mmrPairs, series.season_id);
	const mmrByKey = new Map<string, number>();
	for (const r of mmrRows) {
		mmrByKey.set(`${r.user_id}|${r.role}`, r.mmr);
	}
	const DEFAULT_MMR = 1500;
	const mmrFor = (userId: string, role: Role): number =>
		Math.round(mmrByKey.get(`${userId}|${role}`) ?? DEFAULT_MMR);

	const t1 = new Map<Role, { userId: string; name: string; mmr: number }>();
	const t2 = new Map<Role, { userId: string; name: string; mmr: number }>();
	for (const p of parts) {
		const target = p.team === "TEAM_1" ? t1 : t2;
		target.set(p.role as Role, {
			userId: p.user_id,
			name: nameById.get(p.user_id) ?? p.user_id,
			mmr: mmrFor(p.user_id, p.role as Role),
		});
	}
	const activeRoles = ROLE_ORDER.filter((r) => t1.has(r) && t2.has(r));

	const t1Sum = activeRoles.reduce((acc, r) => acc + (t1.get(r)?.mmr ?? 0), 0);
	const t2Sum = activeRoles.reduce((acc, r) => acc + (t2.get(r)?.mmr ?? 0), 0);
	const teamSize = activeRoles.length;
	const t1Avg = teamSize > 0 ? Math.round(t1Sum / teamSize) : 0;
	const t2Avg = teamSize > 0 ? Math.round(t2Sum / teamSize) : 0;

	return renderBalanceSvg({
		seriesId: series.id,
		seasonId: series.season_id,
		teamSize,
		team1Side,
		team2Side,
		roles: activeRoles,
		t1,
		t2,
		t1Avg,
		t2Avg,
	});
}

interface RenderInput {
	seriesId: number;
	seasonId: number;
	teamSize: number;
	team1Side: BalanceSide;
	team2Side: BalanceSide;
	roles: Role[];
	t1: Map<Role, { userId: string; name: string; mmr: number }>;
	t2: Map<Role, { userId: string; name: string; mmr: number }>;
	t1Avg: number;
	t2Avg: number;
}

function sideColor(side: BalanceSide): string {
	return side === "BLUE" ? "#5865f2" : "#ed4245";
}

function escXml(s: string): string {
	return s.replace(/[&<>"']/g, (c) => {
		switch (c) {
			case "&":
				return "&amp;";
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case '"':
				return "&quot;";
			case "'":
				return "&apos;";
		}
		return c;
	});
}

function renderBalanceSvg(input: RenderInput): string {
	const width = 720;
	const padding = 24;
	const headerH = 64;
	const teamHeaderH = 40;
	const rowH = 44;
	const summaryH = 48;
	const footerH = 28;
	const rowsTotal = Math.max(1, input.roles.length) * rowH;
	const height = headerH + teamHeaderH + rowsTotal + summaryH + footerH + padding * 2;

	const t1Color = sideColor(input.team1Side);
	const t2Color = sideColor(input.team2Side);
	const colCenter = width / 2;
	const t1ColX = padding;
	const t2ColX = width / 2 + 8;
	const colW = width / 2 - padding - 8;

	const yHeader = padding;
	const yTeamHeader = yHeader + headerH;
	const yRow0 = yTeamHeader + teamHeaderH;
	const ySummary = yRow0 + rowsTotal;

	const rows = input.roles
		.map((role, i) => {
			const a = input.t1.get(role);
			const b = input.t2.get(role);
			if (!a || !b) return "";
			const y = yRow0 + i * rowH;
			const yMid = y + rowH / 2;
			return [
				`<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="rgba(127,127,127,0.18)" stroke-width="1"/>`,
				`<rect x="${colCenter - 28}" y="${yMid - 12}" width="56" height="24" rx="12" fill="rgba(127,127,127,0.18)"/>`,
				`<text x="${colCenter}" y="${yMid}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="600" fill="currentColor">${ROLE_LABEL[role]}</text>`,
				`<text x="${colCenter - 40}" y="${yMid}" text-anchor="end" dominant-baseline="central" font-size="15" font-weight="600" fill="currentColor">${escXml(a.name)}</text>`,
				`<text x="${colCenter - 40}" y="${yMid + 16}" text-anchor="end" font-size="11" fill="rgba(127,127,127,0.9)">${a.mmr}</text>`,
				`<text x="${colCenter + 40}" y="${yMid}" text-anchor="start" dominant-baseline="central" font-size="15" font-weight="600" fill="currentColor">${escXml(b.name)}</text>`,
				`<text x="${colCenter + 40}" y="${yMid + 16}" text-anchor="start" font-size="11" fill="rgba(127,127,127,0.9)">${b.mmr}</text>`,
			].join("");
		})
		.join("\n");

	const today = new Date();
	const kst = new Date(today.getTime() + 9 * 3600 * 1000);
	const dateStr = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="-apple-system,BlinkMacSystemFont,'Pretendard','Noto Sans KR',sans-serif" color="#dcddde">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#1a1c20" rx="12"/>
  <!-- Header -->
  <text x="${padding}" y="${yHeader + 24}" font-size="20" font-weight="700" fill="#dcddde">시리즈 #${input.seriesId} · Bo3 ${input.teamSize}v${input.teamSize}</text>
  <text x="${padding}" y="${yHeader + 48}" font-size="13" fill="rgba(220,221,222,0.6)">시즌 #${input.seasonId} · Game 1 사이드 확정</text>

  <!-- Team headers -->
  <rect x="${t1ColX}" y="${yTeamHeader}" width="${colW}" height="${teamHeaderH - 8}" rx="6" fill="${t1Color}" fill-opacity="0.18" stroke="${t1Color}" stroke-opacity="0.55"/>
  <text x="${t1ColX + colW / 2}" y="${yTeamHeader + (teamHeaderH - 8) / 2}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="700" fill="${t1Color}">1팀 · ${input.team1Side}</text>
  <rect x="${t2ColX}" y="${yTeamHeader}" width="${colW}" height="${teamHeaderH - 8}" rx="6" fill="${t2Color}" fill-opacity="0.18" stroke="${t2Color}" stroke-opacity="0.55"/>
  <text x="${t2ColX + colW / 2}" y="${yTeamHeader + (teamHeaderH - 8) / 2}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="700" fill="${t2Color}">2팀 · ${input.team2Side}</text>

  <!-- Rows -->
  ${rows}
  <line x1="${padding}" y1="${yRow0 + rowsTotal}" x2="${width - padding}" y2="${yRow0 + rowsTotal}" stroke="rgba(127,127,127,0.18)" stroke-width="1"/>

  <!-- Summary (avg MMR) -->
  <text x="${t1ColX + colW / 2}" y="${ySummary + summaryH / 2}" text-anchor="middle" dominant-baseline="central" font-size="13" fill="rgba(220,221,222,0.85)">평균 MMR <tspan font-weight="700" fill="${t1Color}">${input.t1Avg}</tspan></text>
  <text x="${t2ColX + colW / 2}" y="${ySummary + summaryH / 2}" text-anchor="middle" dominant-baseline="central" font-size="13" fill="rgba(220,221,222,0.85)">평균 MMR <tspan font-weight="700" fill="${t2Color}">${input.t2Avg}</tspan></text>

  <!-- Footer -->
  <text x="${width - padding}" y="${ySummary + summaryH + footerH / 2 + 4}" text-anchor="end" font-size="11" fill="rgba(220,221,222,0.5)">${dateStr} (KST)</text>
</svg>`;
}
