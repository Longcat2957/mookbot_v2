import type { FormEvent } from "react";
import { useState } from "react";
import { InlineNotice, PanelCard, SectionHeader } from "../../components/DesignPrimitives.js";
import { LINK_FORM_INITIAL, type LinkFormState } from "./types.js";

interface Props {
	onLink: (riotId: string) => Promise<void>;
}

export function LinkAccountForm({ onLink }: Props) {
	const [linkForm, setLinkForm] = useState<LinkFormState>(LINK_FORM_INITIAL);

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		const trimmed = linkForm.riotId.trim();
		if (!trimmed) return;
		setLinkForm((state) => ({ ...state, busy: true, error: null }));
		try {
			await onLink(trimmed);
			setLinkForm(LINK_FORM_INITIAL);
		} catch (err) {
			setLinkForm((state) => ({ ...state, error: err instanceof Error ? err.message : String(err) }));
		} finally {
			setLinkForm((state) => ({ ...state, busy: false }));
		}
	};

	return (
		<form onSubmit={handleSubmit}>
			<PanelCard bodyClassName="p-3 gap-2">
				<SectionHeader
					title={<span className="text-base">새 계정 추가</span>}
					description={
						<span>
							<code className="bg-base-300 px-1 rounded">GameName#TagLine</code> 형식으로 입력하세요.
							라이엇 서버에서 검증합니다.
						</span>
					}
				/>
				<div className="join">
					<input
						type="text"
						value={linkForm.riotId}
						onChange={(e) => setLinkForm((state) => ({ ...state, riotId: e.target.value }))}
						placeholder="예: Hide on bush#KR1"
						className="input input-sm input-bordered join-item flex-1"
						disabled={linkForm.busy}
					/>
					<button
						type="submit"
						className="btn btn-sm btn-primary join-item"
						disabled={linkForm.busy || !linkForm.riotId.trim()}
					>
						{linkForm.busy ? (
							<>
								<span className="loading loading-spinner loading-xs" />
								연결 중...
							</>
						) : (
							"+ 연결"
						)}
					</button>
				</div>
				{linkForm.error && <InlineNotice tone="error">{linkForm.error}</InlineNotice>}
			</PanelCard>
		</form>
	);
}
