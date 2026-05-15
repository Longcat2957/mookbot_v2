const MEMBER_SLOTS = [1, 2, 3, 4, 5] as const;

export function BiddingTeamFillMeter({ memberCount }: { memberCount: number }) {
	const cappedMemberCount = Math.min(memberCount, 5);
	const full = cappedMemberCount >= 5;

	return (
		<div className="space-y-1.5">
			<div className="flex items-center justify-between text-sm">
				<span className="font-medium">팀원</span>
				<span
					className={`tabular-nums ${full ? "text-success font-semibold" : "text-base-content/60"}`}
				>
					{memberCount}/5
				</span>
			</div>
			<div className="grid grid-cols-5 gap-1.5">
				{MEMBER_SLOTS.map((slot) => {
					const filled = slot <= cappedMemberCount;

					return (
						<div
							key={slot}
							className={`h-3 rounded-sm border transition-colors ${
								filled
									? full
										? "border-success bg-success"
										: "border-info bg-info"
									: "border-base-300 bg-base-100"
							}`}
							aria-hidden
						/>
					);
				})}
			</div>
		</div>
	);
}
