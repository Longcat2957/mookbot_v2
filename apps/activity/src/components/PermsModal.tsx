// 내 권한 진단 modal — `/api/me/perms` (apps/api/src/auth/perms.ts:diagnosePerms) 결과 표시.
// v0.3.23 BalanceTeam 정책 가시성 — 사용자가 본인 BalanceTeam 보유 여부를 자가진단.

import { useEffect, useRef } from "react";
import { MemberRolesSection } from "./PermsModal/MemberRolesSection.js";
import { OperatorRoleSection } from "./PermsModal/OperatorRoleSection.js";
import { PermsStatusCard } from "./PermsModal/PermsStatusCard.js";
import { usePermsDiagnosis } from "./PermsModal/usePermsDiagnosis.js";

interface Props {
	open: boolean;
	onClose: () => void;
}

export function PermsModal({ open, onClose }: Props) {
	const dialogRef = useRef<HTMLDialogElement | null>(null);
	const { data, loading, err, reload, memberRoleNames } = usePermsDiagnosis();

	// 진단 데이터 + 전역 perms context 동시 refresh — 모달 open 시 / "재확인" 클릭 시.
	useEffect(() => {
		const dlg = dialogRef.current;
		if (!dlg) return;
		if (open && !dlg.open) dlg.showModal();
		else if (!open && dlg.open) dlg.close();
	}, [open]);

	useEffect(() => {
		const dlg = dialogRef.current;
		if (!dlg) return;
		const handleClose = () => onClose();
		dlg.addEventListener("close", handleClose);
		return () => dlg.removeEventListener("close", handleClose);
	}, [onClose]);

	useEffect(() => {
		if (!open) return;
		reload();
	}, [open, reload]);

	return (
		<dialog ref={dialogRef} className="modal modal-bottom sm:modal-middle">
			<div className="modal-box max-w-lg">
				<div className="flex items-center justify-between mb-3">
					<h3 className="font-bold text-lg">내 권한 확인</h3>
					<form method="dialog">
						<button type="submit" className="btn btn-sm btn-circle btn-ghost" aria-label="닫기">
							✕
						</button>
					</form>
				</div>

				{loading && (
					<div className="flex items-center gap-2 text-sm text-base-content/70 py-6 justify-center">
						<span className="loading loading-spinner loading-sm" />
						<span>권한 확인 중...</span>
					</div>
				)}

				{err && (
					<div className="alert alert-error text-sm">
						<span>권한 확인 실패: {err}</span>
					</div>
				)}

				{data && !loading && (
					<div className="space-y-4">
						<PermsStatusCard data={data} />
						<OperatorRoleSection data={data} />
						<MemberRolesSection data={data} memberRoleNames={memberRoleNames} />
					</div>
				)}

				<div className="modal-action mt-4 gap-2">
					<button type="button" className="btn btn-sm btn-ghost" onClick={reload} disabled={loading}>
						{loading ? "확인 중…" : "↻ 재확인"}
					</button>
					<form method="dialog">
						<button type="submit" className="btn btn-sm">
							닫기
						</button>
					</form>
				</div>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button type="submit" aria-label="배경 클릭으로 닫기">
					close
				</button>
			</form>
		</dialog>
	);
}
