// 현재 사용자의 쓰기 권한을 전역으로 공유 (Context).

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { api } from "../api/rest.js";
import { wsClient } from "../api/ws.js";

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
			.then((info) => {
				setMe(info);
				// WS 클라이언트에 본인 user id 등록 — origin echo 필터링
				if (info.discordId) wsClient.setMyUserId(info.discordId);
			})
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
