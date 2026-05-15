export function SeriesResultSkeleton() {
	return (
		<section className="space-y-4">
			<div className="flex items-center justify-between">
				<div className="space-y-2">
					<div className="skeleton h-7 w-48" />
					<div className="skeleton h-4 w-32" />
				</div>
				<div className="skeleton h-8 w-24" />
			</div>
			<div className="skeleton h-24 w-full" />
			<div className="skeleton h-24 w-full" />
			{[0, 1, 2].map((i) => (
				<div key={i} className="skeleton h-48 w-full" />
			))}
		</section>
	);
}
