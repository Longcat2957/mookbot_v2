import { AccountCard } from "./AccountCard.js";
import type { Account } from "./types.js";

interface Props {
	accounts: Account[] | null;
	busyPuuid: string | null;
	onSetMain: (puuid: string) => void;
	onRefresh: (puuid: string) => void;
	onUnlink: (account: Account) => void;
}

export function AccountsList({ accounts, busyPuuid, onSetMain, onRefresh, onUnlink }: Props) {
	return (
		<div className="card surface-base shadow-sm">
			<div className="card-body p-3 gap-2">
				<h3 className="card-title text-base">연결된 계정</h3>
				{accounts === null ? (
					<div className="flex items-center gap-2 py-4 justify-center text-sm text-base-content/60">
						<span className="loading loading-spinner loading-sm" />
						불러오는 중...
					</div>
				) : accounts.length === 0 ? (
					<div className="text-sm italic text-base-content/60 py-3 text-center">
						연결된 계정이 없습니다. 아래에서 추가하세요.
					</div>
				) : (
					<ul className="space-y-2">
						{accounts.map((account) => (
							<AccountCard
								key={account.puuid}
								account={account}
								busy={busyPuuid === account.puuid}
								onSetMain={onSetMain}
								onRefresh={onRefresh}
								onUnlink={onUnlink}
							/>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
