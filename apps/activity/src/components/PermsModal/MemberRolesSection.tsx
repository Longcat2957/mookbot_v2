import type { DiagPerms } from "./types.js";

export function MemberRolesSection({
	data,
	memberRoleNames,
}: {
	data: DiagPerms;
	memberRoleNames: { id: string; name: string }[];
}) {
	return (
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
					{memberRoleNames.map((role) => {
						const isOperator = role.id === data.resolvedOperatorRoleId;
						return (
							<span
								key={role.id}
								className={`badge ${isOperator ? "badge-success" : "badge-ghost"}`}
								title={role.id}
							>
								{isOperator && "★ "}
								{role.name}
							</span>
						);
					})}
				</div>
			)}
		</section>
	);
}
