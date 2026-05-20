export function ProfileSkeleton() {
	const lanePlaceholders = ["top", "jungle", "mid", "bottom", "support"];
	return (
		<section className="space-y-4">
			<div className="skeleton h-48 w-full rounded-lg" />
			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
				{lanePlaceholders.map((lane) => (
					<div key={lane} className="skeleton h-28 w-full rounded-lg" />
				))}
			</div>
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<div className="skeleton h-64 w-full rounded-lg" />
				<div className="skeleton h-64 w-full rounded-lg" />
			</div>
		</section>
	);
}
