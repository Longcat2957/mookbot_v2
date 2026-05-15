import { useCallback, useState } from "react";
import { api } from "../../api/rest.js";
import { showToast } from "../../components/Toaster.js";
import { useStaleWhileRevalidate } from "../../state/useStaleWhileRevalidate.js";
import { EditPreferenceModal } from "./Preferences/EditPreferenceModal.js";
import { LanePreferenceCard } from "./Preferences/LanePreferenceCard.js";
import { type PreferencesResponse, ROLES, type Role } from "./Preferences/types.js";

export function Preferences({ userId, isMe }: { userId: string; isMe: boolean }) {
	const fetcher = useCallback(
		() => api<PreferencesResponse>(`/users/${userId}/preferences`),
		[userId],
	);
	const swr = useStaleWhileRevalidate<PreferencesResponse>(`prefs:${userId}`, fetcher, {
		debounceMs: 150,
	});
	const data = swr.data;
	const [editingRole, setEditingRole] = useState<Role | null>(null);

	if (swr.error) {
		return (
			<div className="alert alert-error">
				<span>선호 챔프를 불러오지 못했습니다: {swr.error}</span>
			</div>
		);
	}

	const isEmpty = data !== null && ROLES.every((r) => (data.preferences[r] ?? []).length === 0);

	return (
		<>
			<div className="space-y-2">
				{!data ? (
					<div className="skeleton h-24 w-full" />
				) : isEmpty && !isMe ? (
					<div className="text-sm text-base-content/50 py-2">등록된 선호 챔프가 없습니다.</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
						{ROLES.map((role) => (
							<LanePreferenceCard
								key={role}
								role={role}
								champs={data.preferences[role] ?? []}
								isMe={isMe}
								onEdit={() => setEditingRole(role)}
							/>
						))}
					</div>
				)}
				{isMe && isEmpty && data && (
					<div className="text-xs text-base-content/60 px-1">
						💡 라인별 즐겨하는 챔프를 등록하면 다른 사람에게도 보입니다.
					</div>
				)}
			</div>

			{isMe && editingRole && data && (
				<EditPreferenceModal
					role={editingRole}
					initial={data.preferences[editingRole] ?? []}
					maxPerRole={data.maxPerRole}
					onClose={() => setEditingRole(null)}
					onSaved={() => {
						setEditingRole(null);
						swr.refresh();
						showToast("선호 챔프가 저장되었습니다");
					}}
				/>
			)}
		</>
	);
}
