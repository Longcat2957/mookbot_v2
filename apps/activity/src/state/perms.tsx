// 현재 사용자의 쓰기 권한을 전역으로 공유 (Context).
//
// 자동 refresh:
//   - mount 시 1회
//   - window focus / document visibilitychange (탭 전환 후 복귀, Activity 재진입)
//
// 실패 시 기존 me 보존 — 한 번 정상 로드된 canEdit:true 가 일시적 fetch 실패로
// canEdit:false 로 downgrade 되는 사고를 막음 (v0.3.27).
//
// 외부에서 수동 refresh 가 필요하면 usePermsRefresh() 훅 사용 (PermsModal 등).

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api/rest.js";
import { wsClient } from "../api/ws.js";

interface MeInfo {
	discordId: string;
	canEdit: boolean;
}

const PermsContext = createContext<MeInfo | null>(null);
const PermsRefreshContext = createContext<() => void>(() => {});

export function PermsProvider({ children }: { children: ReactNode }) {
	const [me, setMe] = useState<MeInfo | null>(null);

	const fetchMe = useCallback(() => {
		api<MeInfo>("/me")
			.then((info) => {
				setMe(info);
				if (info.discordId) wsClient.setMyUserId(info.discordId);
			})
			.catch((err) => {
				console.warn("[mookbot] /api/me fetch failed", err);
				// 한 번이라도 정상 로드된 me 가 있으면 보존 — 일시 장애로 권한
				// downgrade 되지 않도록. 첫 fetch 실패 때만 default 적용.
				setMe((prev) => prev ?? { discordId: "", canEdit: false });
			});
	}, []);

	useEffect(() => {
		fetchMe();

		const onFocus = () => fetchMe();
		const onVisibility = () => {
			if (document.visibilityState === "visible") fetchMe();
		};
		window.addEventListener("focus", onFocus);
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			window.removeEventListener("focus", onFocus);
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [fetchMe]);

	return (
		<PermsRefreshContext.Provider value={fetchMe}>
			<PermsContext.Provider value={me}>{children}</PermsContext.Provider>
		</PermsRefreshContext.Provider>
	);
}

export function usePerms(): MeInfo {
	const v = useContext(PermsContext);
	return v ?? { discordId: "", canEdit: false };
}

export function usePermsRefresh(): () => void {
	return useContext(PermsRefreshContext);
}
