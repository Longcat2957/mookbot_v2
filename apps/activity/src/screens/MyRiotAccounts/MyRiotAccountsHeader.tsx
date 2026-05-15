interface Props {
	onBack: () => void;
}

export function MyRiotAccountsHeader({ onBack }: Props) {
	return (
		<header className="flex items-center justify-between flex-wrap gap-2">
			<div>
				<h2 className="text-xl font-bold">라이엇 계정 관리</h2>
				<p className="text-xs text-base-content/70">
					여러 계정 연결 가능 · 메인은 한 개 · 게임 기록은 디스코드 계정에 영구 보존
				</p>
			</div>
			<button type="button" className="btn btn-sm btn-ghost" onClick={onBack}>
				돌아가기
			</button>
		</header>
	);
}
