// 픽/밴 콤마 일괄 입력.
// 운영자가 게임 종료 후 챔프 다섯/다섯 + 밴을 한 줄에 입력해 빠르게 채우기 위함.
//
// 매칭 규칙:
//   1. 한글 name 정확 ("리신")
//   2. 영문 idSlug 정확 ("leesin", 대소문자/공백 무시)
//   3. 한글 name prefix ("아트" → 아트록스)
//   4. substring fallback
// 빈 토큰은 그 슬롯을 비워두지 않고 "기존 값 유지" — 불필요한 clear 회피.
// 실패 토큰은 toast 로 알림 + 해당 슬롯도 기존 값 유지.

import { useState } from "react";
import { showToast } from "../../components/Toaster.js";
import type { Champion, Team } from "./types.js";

function normalize(s: string): string {
	return s.trim().toLowerCase().replace(/\s+/g, "");
}

function matchChampion(token: string, champions: Champion[]): Champion | null {
	const q = normalize(token);
	if (!q) return null;

	// 1. 정확 매치 (한글 name 또는 영문 idSlug)
	for (const c of champions) {
		if (normalize(c.name) === q) return c;
		if (normalize(c.idSlug) === q) return c;
	}
	// 2. 한글 name prefix
	for (const c of champions) {
		if (normalize(c.name).startsWith(q)) return c;
	}
	// 3. 영문 idSlug prefix
	for (const c of champions) {
		if (normalize(c.idSlug).startsWith(q)) return c;
	}
	// 4. substring fallback
	for (const c of champions) {
		if (normalize(c.name).includes(q)) return c;
		if (normalize(c.idSlug).includes(q)) return c;
	}
	return null;
}

interface ParseResult {
	matched: (Champion | null)[]; // null = 빈 토큰 또는 매칭 실패 → 기존 값 유지
	failed: string[]; // 매칭 실패 토큰 (빈 토큰은 제외)
}

function parseAndMatch(input: string, champions: Champion[], maxCount: number): ParseResult {
	const tokens = input.split(",").map((t) => t.trim());
	const matched: (Champion | null)[] = [];
	const failed: string[] = [];

	for (let i = 0; i < tokens.length && matched.length < maxCount; i++) {
		const tok = tokens[i] ?? "";
		if (tok === "") {
			matched.push(null);
			continue;
		}
		const m = matchChampion(tok, champions);
		if (m) {
			matched.push(m);
		} else {
			matched.push(null);
			failed.push(tok);
		}
	}
	return { matched, failed };
}

interface PreparedChange {
	team: Team;
	kind: "ban" | "pick";
	championIds: (number | null)[];
	failed: string[];
	filledCount: number;
}

function prepareChange(
	team: Team,
	kind: "ban" | "pick",
	input: string,
	champions: Champion[],
	teamSize: number,
): PreparedChange | null {
	const value = input.trim();
	if (!value) return null;
	const { matched, failed } = parseAndMatch(value, champions, teamSize);
	const championIds = matched.map((c) => c?.id ?? null);
	return {
		team,
		kind,
		championIds,
		failed,
		filledCount: championIds.filter((c) => c !== null).length,
	};
}

function teamLabel(t: Team): string {
	return t === "TEAM_1" ? "1팀" : "2팀";
}

function kindLabel(k: "ban" | "pick"): string {
	return k === "pick" ? "픽" : "밴";
}

export function BulkInput({
	champions,
	teamSize,
	onApply,
}: {
	champions: Champion[];
	teamSize: number;
	onApply: (changes: { team: Team; kind: "ban" | "pick"; championIds: (number | null)[] }[]) => void;
}) {
	const [t1Pick, setT1Pick] = useState("");
	const [t1Ban, setT1Ban] = useState("");
	const [t2Pick, setT2Pick] = useState("");
	const [t2Ban, setT2Ban] = useState("");

	function apply(team: Team, kind: "ban" | "pick", input: string) {
		const c = prepareChange(team, kind, input, champions, teamSize);
		if (!c) {
			showToast("입력이 비었습니다");
			return;
		}
		onApply([{ team: c.team, kind: c.kind, championIds: c.championIds }]);
		const parts = [`${teamLabel(c.team)} ${kindLabel(c.kind)} ${c.filledCount}/${teamSize} 적용`];
		if (c.failed.length > 0) parts.push(`매칭 실패: ${c.failed.join(", ")}`);
		showToast(parts.join(" · "));
	}

	function applyAll() {
		const prepared: PreparedChange[] = [];
		for (const inp of [
			{ team: "TEAM_1" as const, kind: "pick" as const, value: t1Pick },
			{ team: "TEAM_1" as const, kind: "ban" as const, value: t1Ban },
			{ team: "TEAM_2" as const, kind: "pick" as const, value: t2Pick },
			{ team: "TEAM_2" as const, kind: "ban" as const, value: t2Ban },
		]) {
			const c = prepareChange(inp.team, inp.kind, inp.value, champions, teamSize);
			if (c) prepared.push(c);
		}
		if (prepared.length === 0) {
			showToast("입력이 모두 비었습니다");
			return;
		}
		// 한 번의 onApply 호출로 모든 변경을 누적 (이전: 4번 연속 호출로 마지막 변경만 반영되던 버그)
		onApply(
			prepared.map((c) => ({
				team: c.team,
				kind: c.kind,
				championIds: c.championIds,
			})),
		);

		const summary = prepared
			.map((c) => `${teamLabel(c.team)}${kindLabel(c.kind)} ${c.filledCount}/${teamSize}`)
			.join(", ");
		const allFailed = prepared.flatMap((c) => c.failed);
		const parts = [`적용: ${summary}`];
		if (allFailed.length > 0) parts.push(`매칭 실패: ${allFailed.join(", ")}`);
		showToast(parts.join(" · "));
	}

	return (
		<details className="rounded-md border border-base-300 bg-base-200/40">
			<summary className="cursor-pointer text-sm font-medium px-3 py-2 select-none flex items-center gap-2">
				<span>📋 일괄 입력</span>
				<span className="text-xs text-base-content/60 font-normal">
					— 콤마(,) 로 구분, 픽 순서: 탑 / 정글 / 미드 / 원딜 / 서폿
				</span>
			</summary>
			<div className="px-3 pb-3 pt-1 space-y-2">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
					<BulkRow
						team="TEAM_1"
						kind="pick"
						value={t1Pick}
						onChange={setT1Pick}
						onApply={apply}
						placeholder="예: leona, ahri, yasuo, ezreal, jhin"
					/>
					<BulkRow
						team="TEAM_2"
						kind="pick"
						value={t2Pick}
						onChange={setT2Pick}
						onApply={apply}
						placeholder="예: 다리우스, 그레이브즈, 아리, 진, 노틸러스"
					/>
					<BulkRow
						team="TEAM_1"
						kind="ban"
						value={t1Ban}
						onChange={setT1Ban}
						onApply={apply}
						placeholder="예: ksante, kaisa, ..."
					/>
					<BulkRow
						team="TEAM_2"
						kind="ban"
						value={t2Ban}
						onChange={setT2Ban}
						onApply={apply}
						placeholder="예: 케넨, 비에고, ..."
					/>
				</div>
				<div className="flex justify-end">
					<button type="button" className="btn btn-sm btn-primary" onClick={applyAll}>
						모두 적용
					</button>
				</div>
				<div className="text-[11px] text-base-content/50">
					빈 토큰 (예: <code>leona, , ahri</code>) 또는 매칭 실패는 해당 슬롯 기존 값을 유지합니다.
				</div>
			</div>
		</details>
	);
}

function BulkRow({
	team,
	kind,
	value,
	onChange,
	onApply,
	placeholder,
}: {
	team: Team;
	kind: "ban" | "pick";
	value: string;
	onChange: (v: string) => void;
	onApply: (team: Team, kind: "ban" | "pick", input: string) => void;
	placeholder: string;
}) {
	const teamLabel = team === "TEAM_1" ? "1팀" : "2팀";
	const kindLabel = kind === "pick" ? "픽" : "밴";
	const accent = team === "TEAM_1" ? "border-info" : "border-error";

	return (
		<div className={`flex items-center gap-1.5 border-l-2 pl-2 ${accent}`}>
			<span className="text-xs font-semibold w-12 shrink-0 tabular-nums">
				{teamLabel} {kindLabel}
			</span>
			<input
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						onApply(team, kind, value);
					}
				}}
				placeholder={placeholder}
				className="input input-sm input-bordered flex-1 min-w-0"
				aria-label={`${teamLabel} ${kindLabel} 일괄 입력`}
			/>
			<button
				type="button"
				className="btn btn-sm btn-ghost"
				onClick={() => onApply(team, kind, value)}
				disabled={value.trim() === ""}
			>
				적용
			</button>
		</div>
	);
}
