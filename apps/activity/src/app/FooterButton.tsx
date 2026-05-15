export function FooterButton({
	icon,
	label,
	active,
	onClick,
	onPrefetch,
}: {
	icon: string;
	label: string;
	active?: boolean;
	onClick: () => void;
	onPrefetch?: () => void;
}) {
	const prefetchProps = onPrefetch
		? {
				onFocus: onPrefetch,
				onPointerEnter: onPrefetch,
			}
		: {};

	return (
		<button
			type="button"
			onClick={onClick}
			className={`btn btn-sm gap-2 ${active ? "btn-primary btn-soft" : "btn-ghost"}`}
			{...prefetchProps}
		>
			<span className="text-base">{icon}</span>
			<span>{label}</span>
		</button>
	);
}
