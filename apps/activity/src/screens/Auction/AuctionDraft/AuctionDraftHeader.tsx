import { ConfirmButton } from "../../../components/ConfirmButton.js";
import { IconButton, SectionHeader, StatusBadge } from "../../../components/DesignPrimitives.js";
import type { TournamentStatus } from "../types.js";
import { statusLabel } from "./statusLabel.js";

export function AuctionDraftHeader({
	tournamentId,
	format,
	status,
	canEdit,
	onRefresh,
	onRevertStage,
}: {
	tournamentId: number;
	format: 10 | 20;
	status: TournamentStatus;
	canEdit: boolean;
	onRefresh: () => void;
	onRevertStage: (status: "CAPTAIN_PICK" | "POINT_ALLOC") => Promise<void>;
}) {
	return (
		<header>
			<SectionHeader
				title={<span className="text-2xl">🎟️ 경매내전 #{tournamentId}</span>}
				description={
					<span>
						{format}인 · 현재 단계: <strong>{statusLabel(status)}</strong>
					</span>
				}
				actions={
					<div className="flex items-center gap-1">
						<StatusBadge tone="primary">{statusLabel(status)}</StatusBadge>
						<IconButton label="새로고침" tooltip="새로고침" onClick={onRefresh}>
							↻
						</IconButton>
						{canEdit && (status === "POINT_ALLOC" || status === "BIDDING") && (
							<StageRevertMenu status={status} onRevertStage={onRevertStage} />
						)}
					</div>
				}
			/>
		</header>
	);
}

function StageRevertMenu({
	status,
	onRevertStage,
}: {
	status: TournamentStatus;
	onRevertStage: (status: "CAPTAIN_PICK" | "POINT_ALLOC") => Promise<void>;
}) {
	return (
		<div className="dropdown dropdown-end">
			<button type="button" tabIndex={0} className="btn btn-ghost btn-sm" aria-label="단계 되돌리기">
				↩ 단계
			</button>
			<div className="dropdown-content bg-base-100 rounded-box z-30 w-60 p-2 shadow-lg border border-base-300 space-y-1">
				<div className="text-xs uppercase tracking-wide text-base-content/60 px-2 pt-1 pb-0.5">
					단계 되돌리기 (위험)
				</div>
				<ConfirmButton
					label="↩ 팀장 재선출 (CAPTAIN_PICK)"
					onConfirm={() => onRevertStage("CAPTAIN_PICK")}
					variant="warning"
					className="w-full justify-start btn-sm"
				/>
				{status === "BIDDING" && (
					<ConfirmButton
						label="↩ 포인트 재배정 (POINT_ALLOC)"
						onConfirm={() => onRevertStage("POINT_ALLOC")}
						variant="warning"
						className="w-full justify-start btn-sm"
					/>
				)}
				<div className="text-[10px] text-base-content/50 px-2 pt-1 leading-snug">
					팀장 재선출: 모든 팀/팀원/입찰 초기화.
					{status === "BIDDING" && " 포인트 재배정: 입찰/팀원(팀장 외) 초기화 + 포인트 reset."}
				</div>
			</div>
		</div>
	);
}
