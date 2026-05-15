import type { DiagPerms } from "./types.js";

export function OperatorRoleSection({ data }: { data: DiagPerms }) {
	return (
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
	);
}
