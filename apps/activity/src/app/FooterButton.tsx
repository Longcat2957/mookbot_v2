export function FooterButton({
	icon,
	label,
	active,
	onClick,
}: {
	icon: string;
	label: string;
	active?: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`btn btn-sm gap-2 ${active ? "btn-primary btn-soft" : "btn-ghost"}`}
		>
			<span className="text-base">{icon}</span>
			<span>{label}</span>
		</button>
	);
}
