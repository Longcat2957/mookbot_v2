import type { DiagPerms } from "./types.js";

export function PermsStatusCard({ data }: { data: DiagPerms }) {
	return (
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
	);
}
