import { cx, PanelCard, SectionHeader } from "../../components/DesignPrimitives.js";
import { winrateTextClassDim } from "../../state/winrateColor.js";
import type { SoloRankedSideRecord } from "./types.js";

const SIDE_LABEL: Record<SoloRankedSideRecord["side"], string> = {
	BLUE: "블루팀",
	RED: "레드팀",
};

const SIDE_CLASS: Record<SoloRankedSideRecord["side"], string> = {
	BLUE: "border-info/40 bg-info/5",
	RED: "border-error/40 bg-error/5",
};

const SIDE_TEXT_CLASS: Record<SoloRankedSideRecord["side"], string> = {
	BLUE: "text-info",
	RED: "text-error",
};

export function SoloRankedSideRecords({ records }: { records: SoloRankedSideRecord[] }) {
	const totalGames = records.reduce((sum, record) => sum + record.games, 0);

	return (
		<PanelCard surface="soft" bodyClassName="p-3">
			<SectionHeader
				title={<span className="text-base">랭크 내전 사이드 전적</span>}
				description="현재 시즌 랭크 시리즈 기준 블루/레드 배정 성과입니다."
			/>
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
				{records.map((record) => (
					<SideRecordTile key={record.side} record={record} />
				))}
			</div>
			{totalGames === 0 && (
				<div className="text-xs text-base-content/50 mt-2">아직 집계할 솔로랭크 기록이 없습니다.</div>
			)}
		</PanelCard>
	);
}

function SideRecordTile({ record }: { record: SoloRankedSideRecord }) {
	const wrPct = Math.round(record.winrate * 100);
	const empty = record.games === 0;

	return (
		<div
			className={cx("rounded-lg border p-3 min-h-24", SIDE_CLASS[record.side], empty && "opacity-60")}
		>
			<div className="flex items-center justify-between gap-2">
				<div className={cx("text-xs font-bold", SIDE_TEXT_CLASS[record.side])}>
					{SIDE_LABEL[record.side]}
				</div>
				<div className={cx("text-xs font-semibold tabular-nums", winrateTextClassDim(wrPct))}>
					{empty ? "기록 없음" : `${wrPct}%`}
				</div>
			</div>
			<div className="mt-2 text-2xl font-bold tabular-nums leading-tight">
				{record.wins}-{record.losses}
			</div>
			<div className="text-xs text-base-content/60 tabular-nums">{record.games}G</div>
		</div>
	);
}
