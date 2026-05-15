export function TableSkeleton() {
	return (
		<div className="rounded-lg border border-base-300 overflow-hidden">
			{[0, 1, 2, 3, 4].map((i) => (
				<div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-base-300">
					<div className="skeleton h-5 w-5" />
					<div className="skeleton h-5 flex-1 max-w-32" />
					<div className="skeleton h-5 w-16" />
				</div>
			))}
		</div>
	);
}
