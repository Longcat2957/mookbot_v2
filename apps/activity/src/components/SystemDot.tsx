// WS 연결 상태 dot. design_upgrade.md §4.2.
// 🟢 정상 = 표시 최소 / 🟡 재연결 = pulse / 🔴 끊김 = 텍스트 동반

import { useEffect, useState } from "react";
import { type WsStatus, wsClient } from "../api/ws.js";

const STATUS_LABEL: Record<WsStatus, string> = {
	connected: "실시간 연결됨",
	reconnecting: "재연결 중…",
	disconnected: "오프라인",
};

const STATUS_DOT: Record<WsStatus, string> = {
	connected: "bg-success",
	reconnecting: "bg-warning animate-pulse",
	disconnected: "bg-error",
};

export function useWsStatus(): WsStatus {
	const [s, setS] = useState<WsStatus>(() => wsClient.getStatus());
	useEffect(() => wsClient.subscribeStatus(setS), []);
	return s;
}

export function SystemDot() {
	const status = useWsStatus();
	return (
		<span className="tooltip tooltip-bottom" data-tip={STATUS_LABEL[status]}>
			<span
				className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-base-300/60 cursor-default"
				aria-label={STATUS_LABEL[status]}
			>
				<span className={`inline-block size-2 rounded-full ${STATUS_DOT[status]}`} aria-hidden />
				{status !== "connected" && (
					<span className="text-xs text-base-content/70">
						{status === "reconnecting" ? "재연결 중" : "오프라인"}
					</span>
				)}
			</span>
		</span>
	);
}
