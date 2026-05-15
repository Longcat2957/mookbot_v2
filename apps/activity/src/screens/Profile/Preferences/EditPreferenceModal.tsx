import { ChampionSearchGrid } from "./ChampionSearchGrid.js";
import { SelectedChampionList } from "./SelectedChampionList.js";
import { type PreferenceChamp, ROLE_LABEL, type Role } from "./types.js";
import { usePreferenceEditor } from "./usePreferenceEditor.js";

export function EditPreferenceModal({
	role,
	initial,
	maxPerRole,
	onClose,
	onSaved,
}: {
	role: Role;
	initial: PreferenceChamp[];
	maxPerRole: number;
	onClose: () => void;
	onSaved: () => void;
}) {
	const editor = usePreferenceEditor({ initial, maxPerRole, onClose, onSaved, role });

	return (
		<dialog className="modal modal-open">
			<div className="modal-box max-w-3xl">
				<div className="flex items-start justify-between gap-2 mb-3">
					<h3 className="font-bold text-lg">{ROLE_LABEL[role]} 선호 챔프 편집</h3>
					<button
						type="button"
						className="btn btn-ghost btn-sm"
						onClick={onClose}
						disabled={editor.saving}
						aria-label="닫기"
					>
						✕
					</button>
				</div>

				<SelectedChampionList
					atLimit={editor.atLimit}
					champById={editor.champById}
					maxPerRole={maxPerRole}
					onMove={editor.move}
					onRemove={editor.removeAt}
					selected={editor.selected}
				/>
				<ChampionSearchGrid
					atLimit={editor.atLimit}
					championsLoaded={editor.champSwr.data !== null}
					filtered={editor.filtered}
					maxPerRole={maxPerRole}
					onSearchChange={editor.setSearch}
					onToggle={editor.toggle}
					search={editor.search}
					searchRef={editor.searchRef}
					selectedSet={editor.selectedSet}
				/>

				{editor.error && (
					<div className="alert alert-error alert-soft mt-3">
						<span>{editor.error}</span>
					</div>
				)}

				<div className="modal-action">
					<button type="button" className="btn btn-ghost" onClick={onClose} disabled={editor.saving}>
						취소
					</button>
					<button
						type="button"
						className="btn btn-primary"
						onClick={editor.save}
						disabled={editor.saving}
					>
						{editor.saving ? <span className="loading loading-spinner loading-sm" /> : "저장"}
					</button>
				</div>
			</div>
			<button
				type="button"
				className="modal-backdrop"
				onClick={() => {
					if (!editor.saving) onClose();
				}}
				aria-label="모달 닫기"
			/>
		</dialog>
	);
}
