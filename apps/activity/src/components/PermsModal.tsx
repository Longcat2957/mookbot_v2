// 내 권한 진단 modal — `/api/me/perms` (apps/api/src/auth/perms.ts:diagnosePerms) 결과 표시.
// v0.3.23 BalanceTeam 정책 가시성 — 사용자가 본인 BalanceTeam 보유 여부를 자가진단.

import { useEffect, useRef, useState } from "react";
import { api } from "../api/rest.js";

interface Props {
	open: boolean;
	onClose: () => void;
}

interface DiagPerms {
	operatorRoleName: string;
	resolvedOperatorRoleId: string | null;
	guildRoles: { id: string; name: string }[];
	memberRoles: string[];
	memberFetchOk: boolean;
	canEdit: boolean;
}

export function PermsModal({ open, onClose }: Props) {
	const dialogRef = useRef<HTMLDialogElement | null>(null);
	const [data, setData] = useState<DiagPerms | null>(null);
	const [loading, setLoading] = useState(false);
	const [err, setErr] = useState<string | null>(null);

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
		setLoading(true);
		setErr(null);
		api<DiagPerms>("/me/perms")
			.then((d) => setData(d))
			.catch((e) => setErr(e instanceof Error ? e.message : String(e)))
			.finally(() => setLoading(false));
	}, [open]);

	const memberRoleNames = (() => {
		if (!data) return [];
		const map = new Map(data.guildRoles.map((r) => [r.id, r.name]));
		return data.memberRoles
			.map((id) => ({ id, name: map.get(id) ?? id }))
			.filter((r) => r.name !== "@everyone");
	})();

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
						<section
							className={`rounded-lg p-3 border-2 ${
								data.canEdit ? "border-success bg-success/10" : "border-base-300 bg-base-200"
							}`}
						>
							<div className="flex items-center gap-2 mb-1">
								<span className="text-2xl">{data.canEdit ? "✏️" : "👁"}</span>
								<span className="font-bold">{data.canEdit ? "운영자 권한" : "읽기 전용"}</span>
								<span className={`badge badge-sm ${data.canEdit ? "badge-success" : "badge-ghost"}`}>
									{data.canEdit ? "쓰기 가능" : "쓰기 불가"}
								</span>
							</div>
							<p className="text-xs text-base-content/70 leading-snug">
								{data.canEdit
									? `길드의 ${data.operatorRoleName} 역할을 보유하여 엔트리/픽밴/결과 입력이 가능합니다.`
									: `엔트리/픽밴/결과 입력 권한이 없습니다. 운영자에게 ${data.operatorRoleName} 역할 부여를 요청하세요.`}
							</p>
						</section>

						<section>
							<h4 className="font-bold text-xs text-base-content/70 uppercase tracking-wide mb-1.5">
								운영자 역할
							</h4>
							<div className="bg-base-200 rounded-md p-2.5 space-y-1 text-sm">
								<div className="flex justify-between gap-2">
									<span className="text-base-content/70">이름</span>
									<span className="font-mono">{data.operatorRoleName}</span>
								</div>
								<div className="flex justify-between gap-2">
									<span className="text-base-content/70">길드 내 ID</span>
									<span className="font-mono text-xs">
										{data.resolvedOperatorRoleId ?? <span className="text-error">길드에서 미발견</span>}
									</span>
								</div>
							</div>
						</section>

						<section>
							<h4 className="font-bold text-xs text-base-content/70 uppercase tracking-wide mb-1.5">
								내가 가진 길드 역할
							</h4>
							{!data.memberFetchOk && (
								<div className="alert alert-warning alert-sm text-xs mb-2">
									<span>길드 멤버 정보를 가져올 수 없었습니다 (봇 권한 확인).</span>
								</div>
							)}
							{memberRoleNames.length === 0 ? (
								<div className="text-xs text-base-content/60 italic px-1">(보유 역할 없음)</div>
							) : (
								<div className="flex flex-wrap gap-1.5">
									{memberRoleNames.map((r) => {
										const isOperator = r.id === data.resolvedOperatorRoleId;
										return (
											<span
												key={r.id}
												className={`badge ${isOperator ? "badge-success" : "badge-ghost"}`}
												title={r.id}
											>
												{isOperator && "★ "}
												{r.name}
											</span>
										);
									})}
								</div>
							)}
						</section>
					</div>
				)}

				<div className="modal-action mt-4">
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
