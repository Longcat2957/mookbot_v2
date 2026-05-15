import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/rest.js";
import { showToast } from "../../components/Toaster.js";
import type { Account, LinkResponse, ListResponse } from "./types.js";

export function useMyRiotAccounts() {
	const [accounts, setAccounts] = useState<Account[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busyPuuid, setBusyPuuid] = useState<string | null>(null);

	const reload = useCallback(async () => {
		setError(null);
		try {
			const r = await api<ListResponse>("/me/riot-accounts");
			setAccounts(r.accounts);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, []);

	useEffect(() => {
		void reload();
	}, [reload]);

	const linkAccount = useCallback(
		async (riotId: string) => {
			const r = await api<LinkResponse>("/me/riot-accounts", {
				method: "POST",
				body: JSON.stringify({ riotId }),
			});
			if (r.account) showToast(`${r.account.gameName}#${r.account.tagLine} 연결됨`);
			await reload();
		},
		[reload],
	);

	const setMain = useCallback(
		async (puuid: string) => {
			setBusyPuuid(puuid);
			try {
				await api(`/me/riot-accounts/${encodeURIComponent(puuid)}/main`, { method: "PUT" });
				showToast("메인 계정 변경됨");
				await reload();
			} catch (err) {
				showToast(`메인 변경 실패: ${err instanceof Error ? err.message : String(err)}`);
			} finally {
				setBusyPuuid(null);
			}
		},
		[reload],
	);

	const refresh = useCallback(
		async (puuid: string) => {
			setBusyPuuid(puuid);
			try {
				await api(`/me/riot-accounts/${encodeURIComponent(puuid)}/refresh`, { method: "POST" });
				showToast("동기화됨");
				await reload();
			} catch (err) {
				showToast(`동기화 실패: ${err instanceof Error ? err.message : String(err)}`);
			} finally {
				setBusyPuuid(null);
			}
		},
		[reload],
	);

	const unlink = useCallback(
		async (account: Account) => {
			if (
				!window.confirm(
					`${account.gameName}#${account.tagLine} 연결을 해제하시겠습니까?\n게임 기록과 MMR 은 디스코드 계정에 연결되어 그대로 유지됩니다.`,
				)
			)
				return;
			setBusyPuuid(account.puuid);
			try {
				await api(`/me/riot-accounts/${encodeURIComponent(account.puuid)}`, { method: "DELETE" });
				showToast("연결 해제됨");
				await reload();
			} catch (err) {
				showToast(`해제 실패: ${err instanceof Error ? err.message : String(err)}`);
			} finally {
				setBusyPuuid(null);
			}
		},
		[reload],
	);

	return {
		accounts,
		error,
		busyPuuid,
		reload,
		linkAccount,
		setMain,
		refresh,
		unlink,
	};
}
