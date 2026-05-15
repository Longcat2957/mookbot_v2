import type { Account } from "./types.js";

interface Props {
	account: Account;
	busy: boolean;
	onSetMain: (puuid: string) => void;
	onRefresh: (puuid: string) => void;
	onUnlink: (account: Account) => void;
}

export function AccountCard({ account, busy, onSetMain, onRefresh, onUnlink }: Props) {
	return (
		<li
			className={`card bg-base-100 border-l-4 ${account.isMain ? "border-warning" : "border-base-300"}`}
		>
			<div className="card-body p-3 gap-2 flex-row items-center flex-wrap">
				{account.profileIconUrl ? (
					<img src={account.profileIconUrl} alt="" className="size-10 rounded shrink-0" loading="lazy" />
				) : (
					<div className="size-10 rounded bg-base-300 shrink-0" />
				)}
				<div className="flex-1 min-w-0">
					<div className="font-bold truncate flex items-center gap-1.5 flex-wrap">
						<span>
							{account.gameName}#{account.tagLine}
						</span>
						{account.isMain && <span className="badge badge-warning badge-sm">메인</span>}
					</div>
				</div>
				<div className="flex flex-wrap gap-1.5">
					{!account.isMain && (
						<button
							type="button"
							className="btn btn-xs btn-ghost"
							onClick={() => onSetMain(account.puuid)}
							disabled={busy}
							title="메인 계정으로 지정"
						>
							메인 지정
						</button>
					)}
					<button
						type="button"
						className="btn btn-xs btn-ghost"
						onClick={() => onRefresh(account.puuid)}
						disabled={busy}
						title="라이엇 API 로 이름/아이콘 재동기화"
					>
						동기화
					</button>
					<button
						type="button"
						className="btn btn-xs btn-ghost text-error"
						onClick={() => onUnlink(account)}
						disabled={busy}
						title="연결 해제"
					>
						해제
					</button>
				</div>
			</div>
		</li>
	);
}
