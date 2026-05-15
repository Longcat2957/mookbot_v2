import { useCallback, useMemo, useState } from "react";
import { api } from "../../api/rest.js";
import { usePermsRefresh } from "../../state/perms.js";
import type { DiagPerms } from "./types.js";

export function usePermsDiagnosis() {
	const [data, setData] = useState<DiagPerms | null>(null);
	const [loading, setLoading] = useState(false);
	const [err, setErr] = useState<string | null>(null);
	const refreshPerms = usePermsRefresh();

	const reload = useCallback(() => {
		setLoading(true);
		setErr(null);
		refreshPerms();
		api<DiagPerms>("/me/perms")
			.then((diag) => setData(diag))
			.catch((error) => setErr(error instanceof Error ? error.message : String(error)))
			.finally(() => setLoading(false));
	}, [refreshPerms]);

	const memberRoleNames = useMemo(() => {
		if (!data) return [];
		const map = new Map(data.guildRoles.map((role) => [role.id, role.name]));
		return data.memberRoles
			.map((id) => ({ id, name: map.get(id) ?? id }))
			.filter((role) => role.name !== "@everyone");
	}, [data]);

	return { data, loading, err, reload, memberRoleNames };
}
