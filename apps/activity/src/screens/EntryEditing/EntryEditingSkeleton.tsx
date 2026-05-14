export function EntryEditingSkeleton() {
	return (
		<section className="space-y-3">
			<div className="flex items-center justify-between">
				<div className="space-y-2">
					<div className="skeleton h-7 w-40" />
					<div className="skeleton h-4 w-64" />
				</div>
				<div className="skeleton h-8 w-32" />
			</div>
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
				{[0, 1].map((i) => (
					<div key={i} className="card surface-base shadow-sm">
						<div className="card-body p-4 gap-3">
							<div className="skeleton h-6 w-16" />
							{[0, 1, 2, 3, 4].map((j) => (
								<div key={j} className="skeleton h-12 w-full" />
							))}
						</div>
					</div>
				))}
			</div>
			<div className="card surface-base shadow-sm">
				<div className="card-body p-4 space-y-3">
					<div className="skeleton h-5 w-32" />
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						{[0, 1, 2, 3].map((i) => (
							<div key={i} className="skeleton h-32 w-full" />
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
