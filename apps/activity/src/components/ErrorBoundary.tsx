// React ErrorBoundary — 자식 컴포넌트의 throw 를 catch 하여 fallback UI 표시.
// 빈 화면(white screen of death) 대신 에러 메시지 + 회복 옵션을 노출.

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
	children: ReactNode;
	// fallback 안 "다시 시도" 버튼이 reset 되었을 때 호출 (선택 — 부모가
	// 어떤 외부 state 를 함께 reset 하고 싶으면)
	onReset?: () => void;
	// 화면 식별 라벨 (에러 페이지 헤더에 표시) — "픽/밴" / "엔트리 수정" 등
	label?: string;
}

interface State {
	error: Error | null;
	errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
	state: State = { error: null, errorInfo: null };

	static getDerivedStateFromError(error: Error): Partial<State> {
		return { error };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		// 콘솔 + (있다면) 외부 알림 채널로 전송. 현재는 콘솔 only.
		console.error("[mookbot] React ErrorBoundary caught", error, errorInfo);
		this.setState({ errorInfo });
	}

	private reset = () => {
		this.setState({ error: null, errorInfo: null });
		this.props.onReset?.();
	};

	render() {
		const { error, errorInfo } = this.state;
		if (!error) return this.props.children;

		const stack = error.stack ?? `${error.name}: ${error.message}`;
		const componentStack = errorInfo?.componentStack ?? null;

		return (
			<div className="card bg-base-200 border border-error/40 shadow-sm">
				<div className="card-body p-5 gap-3">
					<div className="flex items-start gap-3">
						<div className="text-3xl text-error leading-none" aria-hidden>
							⚠️
						</div>
						<div className="flex-1 min-w-0">
							<h2 className="text-lg font-bold text-error">
								{this.props.label
									? `${this.props.label} — 화면 렌더링 오류`
									: "화면 렌더링 오류"}
							</h2>
							<p className="text-sm text-base-content/70 mt-1">
								예상치 못한 오류가 발생했습니다. 아래 정보를 운영자에게 전달하면
								진단에 도움이 됩니다.
							</p>
						</div>
					</div>

					<div className="bg-base-300 rounded-md p-3 overflow-auto max-h-48">
						<pre className="text-xs text-base-content/90 whitespace-pre-wrap break-words">
							{stack}
						</pre>
					</div>

					{componentStack && (
						<details className="bg-base-300/60 rounded-md p-2">
							<summary className="cursor-pointer text-xs text-base-content/70">
								컴포넌트 스택
							</summary>
							<pre className="text-[10px] text-base-content/70 whitespace-pre-wrap mt-2 max-h-40 overflow-auto">
								{componentStack}
							</pre>
						</details>
					)}

					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							className="btn btn-sm btn-primary"
							onClick={this.reset}
						>
							↻ 다시 시도
						</button>
						<button
							type="button"
							className="btn btn-sm btn-outline"
							onClick={() => window.location.reload()}
						>
							페이지 새로고침
						</button>
						<button
							type="button"
							className="btn btn-sm btn-ghost"
							onClick={() => {
								navigator.clipboard
									?.writeText(`${stack}\n\n${componentStack ?? ""}`)
									.catch(() => undefined);
							}}
						>
							📋 에러 복사
						</button>
					</div>
				</div>
			</div>
		);
	}
}
