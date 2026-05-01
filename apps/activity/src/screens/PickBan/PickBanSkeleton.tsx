export function PickBanSkeleton() {
	return (
		<section className="space-y-4">
			<div className="flex items-center justify-between">
				<div className="space-y-2">
					<div className="skeleton h-7 w-32" />
					<div className="skeleton h-4 w-48" />
				</div>
				<div className="skeleton h-8 w-32" />
			</div>
			<div className="skeleton h-32 w-full" />
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
				<div className="skeleton h-96 w-full" />
				<div className="skeleton h-96 w-full" />
				<div className="skeleton h-96 w-full" />
			</div>
		</section>
	);
}
