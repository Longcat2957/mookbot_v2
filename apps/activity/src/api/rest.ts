export async function api<T>(path: string, init?: RequestInit): Promise<T> {
	// body 가 있을 때만 Content-Type: application/json — 빈 body 에 헤더 설정하면
	// Fastify 가 "Body cannot be empty when content-type is set to application/json" 으로 400 반환.
	const headers: Record<string, string> = { ...((init?.headers as Record<string, string>) ?? {}) };
	if (init?.body !== undefined && !("Content-Type" in headers)) {
		headers["Content-Type"] = "application/json";
	}

	const res = await fetch(`/api${path}`, {
		credentials: "include",
		...init,
		headers,
	});
	if (!res.ok) {
		// 가능하면 서버 에러 메시지 그대로 노출
		let detail = "";
		try {
			const data = (await res.clone().json()) as { error?: string };
			if (data?.error) detail = `: ${data.error}`;
		} catch {
			// no-op
		}
		throw new Error(`${res.status} ${res.statusText}${detail}`);
	}
	if (res.status === 204) return undefined as T;
	const text = await res.text();
	if (!text) return undefined as T;
	return JSON.parse(text) as T;
}
