import { AccountsList } from "./MyRiotAccounts/AccountsList.js";
import { LinkAccountForm } from "./MyRiotAccounts/LinkAccountForm.js";
import { MyRiotAccountsHeader } from "./MyRiotAccounts/MyRiotAccountsHeader.js";
import { useMyRiotAccounts } from "./MyRiotAccounts/useMyRiotAccounts.js";

export function MyRiotAccounts({ onBack }: { onBack: () => void }) {
	const { accounts, error, busyPuuid, reload, linkAccount, setMain, refresh, unlink } =
		useMyRiotAccounts();

	return (
		<section className="space-y-3 max-w-2xl mx-auto">
			<MyRiotAccountsHeader onBack={onBack} />

			{error && (
				<div className="alert alert-error text-sm">
					<span>{error}</span>
					<button type="button" className="btn btn-xs btn-ghost" onClick={() => void reload()}>
						↻ 다시 시도
					</button>
				</div>
			)}

			<AccountsList
				accounts={accounts}
				busyPuuid={busyPuuid}
				onSetMain={setMain}
				onRefresh={refresh}
				onUnlink={unlink}
			/>
			<LinkAccountForm onLink={linkAccount} />
		</section>
	);
}
