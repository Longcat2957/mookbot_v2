import { ROLE_COLOR, ROLE_LABEL, ROLES, type Role } from "./types.js";

export function RoleToggleBar({
	activeRoles,
	onToggle,
}: {
	activeRoles: Set<Role>;
	onToggle: (role: Role) => void;
}) {
	return (
		<div className="flex flex-wrap gap-2">
			{ROLES.map((role) => {
				const active = activeRoles.has(role);
				return (
					<button
						key={role}
						type="button"
						onClick={() => onToggle(role)}
						className={`btn btn-xs ${active ? "" : "btn-ghost opacity-60"}`}
						style={{
							borderColor: active ? ROLE_COLOR[role] : "transparent",
							color: active ? ROLE_COLOR[role] : undefined,
						}}
						aria-pressed={active}
					>
						<span
							className="inline-block w-2 h-2 rounded-full mr-1"
							style={{ background: ROLE_COLOR[role] }}
						/>
						{ROLE_LABEL[role]}
					</button>
				);
			})}
		</div>
	);
}
