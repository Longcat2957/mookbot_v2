const RENDER_METRICS_KEY = "mookbot:renderMetrics";

const counters = new Map<string, number>();
let enabledCache: boolean | null = null;
let scheduledFlush = false;

declare global {
	interface Window {
		__mookbotRenderMetrics?: { component: string; renders: number }[];
	}
}

function isRenderMetricsEnabled() {
	if (enabledCache !== null) return enabledCache;
	if (typeof window === "undefined") {
		enabledCache = false;
		return enabledCache;
	}
	const params = new URLSearchParams(window.location.search);
	enabledCache =
		params.get("renderMetrics") === "1" || window.localStorage.getItem(RENDER_METRICS_KEY) === "1";
	return enabledCache;
}

function flushRenderMetrics() {
	scheduledFlush = false;
	if (counters.size === 0) return;
	const rows = [...counters.entries()].map(([component, renders]) => ({ component, renders }));
	counters.clear();
	window.__mookbotRenderMetrics = rows;
	window.dispatchEvent(new CustomEvent("mookbot:renderMetrics", { detail: rows }));
}

export function markRender(component: string) {
	if (!isRenderMetricsEnabled()) return;
	counters.set(component, (counters.get(component) ?? 0) + 1);
	if (scheduledFlush || typeof window === "undefined") return;
	scheduledFlush = true;
	window.setTimeout(flushRenderMetrics, 1000);
}
