import { useState } from "react";
import { showToast } from "../../components/Toaster.js";
import { BulkInputRow } from "./BulkInputRow.js";
import {
	type PreparedBulkChange,
	prepareBulkChange,
	summarizeBulkChange,
	summarizeBulkChanges,
	toAppliedChanges,
} from "./bulkInputLogic.js";
import type { Champion, Team } from "./types.js";

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
		const change = prepareBulkChange(team, kind, input, champions, teamSize);
		if (!change) {
			showToast("입력이 비었습니다");
			return;
		}
		onApply(toAppliedChanges([change]));
		const parts = [summarizeBulkChange(change, teamSize)];
		if (change.failed.length > 0) parts.push(`매칭 실패: ${change.failed.join(", ")}`);
		showToast(parts.join(" · "));
	}

	function applyAll() {
		const prepared: PreparedBulkChange[] = [];
		for (const inp of [
			{ team: "TEAM_1" as const, kind: "pick" as const, value: t1Pick },
			{ team: "TEAM_1" as const, kind: "ban" as const, value: t1Ban },
			{ team: "TEAM_2" as const, kind: "pick" as const, value: t2Pick },
			{ team: "TEAM_2" as const, kind: "ban" as const, value: t2Ban },
		]) {
			const c = prepareBulkChange(inp.team, inp.kind, inp.value, champions, teamSize);
			if (c) prepared.push(c);
		}
		if (prepared.length === 0) {
			showToast("입력이 모두 비었습니다");
			return;
		}
		// 한 번의 onApply 호출로 모든 변경을 누적 (이전: 4번 연속 호출로 마지막 변경만 반영되던 버그)
		onApply(toAppliedChanges(prepared));

		const summary = summarizeBulkChanges(prepared, teamSize);
		const allFailed = prepared.flatMap((c) => c.failed);
		const parts = [`적용: ${summary}`];
		if (allFailed.length > 0) parts.push(`매칭 실패: ${allFailed.join(", ")}`);
		showToast(parts.join(" · "));
	}

	return (
		<details className="surface-soft rounded-md">
			<summary className="cursor-pointer text-sm font-medium px-3 py-2 select-none flex items-center gap-2">
				<span>📋 일괄 입력</span>
				<span className="text-xs text-base-content/60 font-normal">
					— 콤마(,) 로 구분, 픽 순서: 탑 / 정글 / 미드 / 원딜 / 서폿
				</span>
			</summary>
			<div className="px-3 pb-3 pt-1 space-y-2">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
					<BulkInputRow
						team="TEAM_1"
						kind="pick"
						value={t1Pick}
						onChange={setT1Pick}
						onApply={apply}
						placeholder="예: leona, ahri, yasuo, ezreal, jhin"
					/>
					<BulkInputRow
						team="TEAM_2"
						kind="pick"
						value={t2Pick}
						onChange={setT2Pick}
						onApply={apply}
						placeholder="예: 다리우스, 그레이브즈, 아리, 진, 노틸러스"
					/>
					<BulkInputRow
						team="TEAM_1"
						kind="ban"
						value={t1Ban}
						onChange={setT1Ban}
						onApply={apply}
						placeholder="예: ksante, kaisa, ..."
					/>
					<BulkInputRow
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
