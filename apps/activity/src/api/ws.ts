// 단일 WebSocket 연결을 공유. topic 별 invalidate 콜백 등록.
// 서버 측 write 후 broadcast(`series:${id}`) 등 → 클라이언트 즉시 reload.
// 단, 본인이 일으킨 변경은 reload 안 함 (입력 보호) — server 가 originUser 포함해서 보냄.

type Listener = () => void;

class WsClient {
	private ws: WebSocket | null = null;
	private listeners = new Map<string, Set<Listener>>();
	private joined = new Set<string>();
	private reconnectTimer: number | null = null;
	private myUserId: string | null = null;

	setMyUserId(id: string): void {
		this.myUserId = id;
	}

	private connect(): void {
		if (this.ws && this.ws.readyState <= 1) return; // CONNECTING or OPEN
		const proto = location.protocol === "https:" ? "wss" : "ws";
		const ws = new WebSocket(`${proto}://${location.host}/ws`);
		this.ws = ws;

		ws.addEventListener("open", () => {
			// 재연결 시 이전 join 복원
			for (const topic of this.joined) {
				ws.send(JSON.stringify({ t: "join", topic }));
			}
		});

		ws.addEventListener("message", (ev) => {
			let msg: { t?: string; topic?: string; originUser?: string };
			try {
				msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
			} catch {
				return;
			}
			if (msg.t === "invalidate" && msg.topic) {
				// 본인이 일으킨 변경은 무시 — 입력 중 self-reload 방지
				if (msg.originUser && this.myUserId && msg.originUser === this.myUserId) {
					return;
				}
				const set = this.listeners.get(msg.topic);
				if (set) for (const cb of set) cb();
			}
		});

		ws.addEventListener("close", () => {
			this.ws = null;
			if (this.reconnectTimer) return;
			this.reconnectTimer = window.setTimeout(() => {
				this.reconnectTimer = null;
				if (this.listeners.size > 0) this.connect();
			}, 1500);
		});

		ws.addEventListener("error", () => {
			ws.close();
		});
	}

	subscribe(topic: string, cb: Listener): () => void {
		this.connect();
		let set = this.listeners.get(topic);
		if (!set) {
			set = new Set();
			this.listeners.set(topic, set);
		}
		set.add(cb);

		if (!this.joined.has(topic)) {
			this.joined.add(topic);
			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
				this.ws.send(JSON.stringify({ t: "join", topic }));
			}
		}

		return () => {
			set.delete(cb);
			if (set.size === 0) this.listeners.delete(topic);
			// joined 는 유지 (재구독 시 즉시 사용). 서버 close 시 정리됨
		};
	}
}

export const wsClient = new WsClient();
