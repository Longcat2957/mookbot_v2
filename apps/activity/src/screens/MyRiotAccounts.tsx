// 본인 라이엇 계정 관리 — 추가 / 메인 전환 / 동기화 / 해제.
// Profile 의 "관리" 버튼으로 진입. 자기 계정만 관리 가능 (서버에서도 sid 강제).

import { useCallback, useEffect, useState } from "react";
import { api } from "../api/rest.js";
import { showToast } from "../components/Toaster.js";

interface Account {
	puuid: string;
	gameName: string;
	tagLine: string;
	isMain: boolean;
	profileIconUrl: string | null;
}

interface ListResponse {
	accounts: Account[];
}

interface LinkResponse {
	account: Account | null;
}

export function MyRiotAccounts({ onBack }: { onBack: () => void }) {
	const [accounts, setAccounts] = useState<Account[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busyPuuid, setBusyPuuid] = useState<string | null>(null);
	const [newRiotId, setNewRiotId] = useState("");
	const [linkBusy, setLinkBusy] = useState(false);
	const [linkError, setLinkError] = useState<string | null>(null);

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

	const handleLink = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = newRiotId.trim();
		if (!trimmed) return;
		setLinkBusy(true);
		setLinkError(null);
		try {
			const r = await api<LinkResponse>("/me/riot-accounts", {
				method: "POST",
				body: JSON.stringify({ riotId: trimmed }),
			});
			if (r.account) showToast(`✅ ${r.account.gameName}#${r.account.tagLine} 연결됨`);
			setNewRiotId("");
			await reload();
		} catch (err) {
			setLinkError(err instanceof Error ? err.message : String(err));
		} finally {
			setLinkBusy(false);
		}
	};

	const handleSetMain = async (puuid: string) => {
		setBusyPuuid(puuid);
		try {
			await api(`/me/riot-accounts/${encodeURIComponent(puuid)}/main`, { method: "PUT" });
			showToast("⭐ 메인 계정 변경됨");
			await reload();
		} catch (err) {
			showToast(`메인 변경 실패: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			setBusyPuuid(null);
		}
	};

	const handleRefresh = async (puuid: string) => {
		setBusyPuuid(puuid);
		try {
			await api(`/me/riot-accounts/${encodeURIComponent(puuid)}/refresh`, { method: "POST" });
			showToast("🔄 동기화됨");
			await reload();
		} catch (err) {
			showToast(`동기화 실패: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			setBusyPuuid(null);
		}
	};

	const handleUnlink = async (acc: Account) => {
		if (
			!window.confirm(
				`${acc.gameName}#${acc.tagLine} 연결을 해제하시겠습니까?\n게임 기록과 MMR 은 디스코드 계정에 연결되어 그대로 유지됩니다.`,
			)
		)
			return;
		setBusyPuuid(acc.puuid);
		try {
			await api(`/me/riot-accounts/${encodeURIComponent(acc.puuid)}`, { method: "DELETE" });
			showToast("🗑 연결 해제됨");
			await reload();
		} catch (err) {
			showToast(`해제 실패: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			setBusyPuuid(null);
		}
	};

	return (
		<section className="space-y-3 max-w-2xl mx-auto">
			<header className="flex items-center justify-between flex-wrap gap-2">
				<div>
					<h2 className="text-xl font-bold">라이엇 계정 관리</h2>
					<p className="text-xs text-base-content/70">
						여러 계정 연결 가능 · 메인은 한 개 · 게임 기록은 디스코드 계정에 영구 보존
					</p>
				</div>
				<button type="button" className="btn btn-sm btn-ghost" onClick={onBack}>
					← 돌아가기
				</button>
			</header>

			{error && (
				<div className="alert alert-error text-sm">
					<span>{error}</span>
					<button type="button" className="btn btn-xs btn-ghost" onClick={() => void reload()}>
						↻ 다시 시도
					</button>
				</div>
			)}

			{/* 연결된 계정 목록 */}
			<div className="card bg-base-200 shadow-sm">
				<div className="card-body p-3 gap-2">
					<h3 className="card-title text-base">연결된 계정</h3>
					{accounts === null ? (
						<div className="flex items-center gap-2 py-4 justify-center text-sm text-base-content/60">
							<span className="loading loading-spinner loading-sm" />
							불러오는 중…
						</div>
					) : accounts.length === 0 ? (
						<div className="text-sm italic text-base-content/60 py-3 text-center">
							연결된 계정이 없습니다. 아래에서 추가하세요.
						</div>
					) : (
						<ul className="space-y-2">
							{accounts.map((a) => {
								const busy = busyPuuid === a.puuid;
								return (
									<li
										key={a.puuid}
										className={`card bg-base-100 border-l-4 ${
											a.isMain ? "border-warning" : "border-base-300"
										}`}
									>
										<div className="card-body p-3 gap-2 flex-row items-center flex-wrap">
											{a.profileIconUrl ? (
												<img
													src={a.profileIconUrl}
													alt=""
													className="size-10 rounded shrink-0"
													loading="lazy"
												/>
											) : (
												<div className="size-10 rounded bg-base-300 shrink-0" />
											)}
											<div className="flex-1 min-w-0">
												<div className="font-bold truncate flex items-center gap-1.5 flex-wrap">
													<span>
														{a.gameName}#{a.tagLine}
													</span>
													{a.isMain && <span className="badge badge-warning badge-sm">⭐ 메인</span>}
												</div>
											</div>
											<div className="flex flex-wrap gap-1.5">
												{!a.isMain && (
													<button
														type="button"
														className="btn btn-xs btn-ghost"
														onClick={() => void handleSetMain(a.puuid)}
														disabled={busy}
														title="메인 계정으로 지정"
													>
														⭐ 메인 지정
													</button>
												)}
												<button
													type="button"
													className="btn btn-xs btn-ghost"
													onClick={() => void handleRefresh(a.puuid)}
													disabled={busy}
													title="라이엇 API 로 이름/아이콘 재동기화"
												>
													🔄 동기화
												</button>
												<button
													type="button"
													className="btn btn-xs btn-ghost text-error"
													onClick={() => void handleUnlink(a)}
													disabled={busy}
													title="연결 해제"
												>
													🗑 해제
												</button>
											</div>
										</div>
									</li>
								);
							})}
						</ul>
					)}
				</div>
			</div>

			{/* 신규 추가 폼 */}
			<form onSubmit={handleLink} className="card bg-base-200 shadow-sm">
				<div className="card-body p-3 gap-2">
					<h3 className="card-title text-base">새 계정 추가</h3>
					<p className="text-xs text-base-content/60">
						<code className="bg-base-300 px-1 rounded">GameName#TagLine</code> 형식으로 입력하세요. 라이엇
						서버에서 검증합니다.
					</p>
					<div className="join">
						<input
							type="text"
							value={newRiotId}
							onChange={(e) => setNewRiotId(e.target.value)}
							placeholder="예: Hide on bush#KR1"
							className="input input-sm input-bordered join-item flex-1"
							disabled={linkBusy}
						/>
						<button
							type="submit"
							className="btn btn-sm btn-primary join-item"
							disabled={linkBusy || !newRiotId.trim()}
						>
							{linkBusy ? (
								<>
									<span className="loading loading-spinner loading-xs" />
									연결 중…
								</>
							) : (
								"+ 연결"
							)}
						</button>
					</div>
					{linkError && (
						<div className="alert alert-error text-xs">
							<span>{linkError}</span>
						</div>
					)}
				</div>
			</form>
		</section>
	);
}
