// [4-end] 시리즈 종료 — 결과 요약. 채널엔 텍스트 알림이 따로 발행됨.

export function Result() {
	return (
		<section className="space-y-4">
			<header>
				<h2 className="text-2xl font-bold">시리즈 종료</h2>
				<p className="text-sm text-base-content/70">결과가 D1 에 기록되었습니다. 채널에 요약 발송됨.</p>
			</header>

			<div className="card bg-base-200 shadow-sm">
				<div className="card-body">
					<h3 className="card-title text-sm">스코어</h3>
					<div className="text-4xl font-bold text-center py-6">
						<span className="text-info">0</span>
						<span className="mx-4 opacity-40">:</span>
						<span className="text-error">0</span>
					</div>
				</div>
			</div>
		</section>
	);
}
