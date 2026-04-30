// 현재 사용자의 쓰기 권한을 전역으로 공유 (Context).

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/rest.js";

interface MeInfo {
	discordId: string;
	canEdit: boolean;
	operatorRoleConfigured: boolean;
}

const PermsContext = createContext<MeInfo | null>(null);

export function PermsProvider({ children }: { children: ReactNode }) {
	const [me, setMe] = useState<MeInfo | null>(null);

	useEffect(() => {
		api<MeInfo>("/me")
			.then(setMe)
			.catch((err) => {
				console.warn("[mookbot] /api/me fetch failed", err);
				setMe({ discordId: "", canEdit: false, operatorRoleConfigured: false });
			});
	}, []);

	return <PermsContext.Provider value={me}>{children}</PermsContext.Provider>;
}

export function usePerms(): MeInfo {
	const v = useContext(PermsContext);
	return v ?? { discordId: "", canEdit: false, operatorRoleConfigured: false };
}
