import { readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// root package.json 의 version 을 빌드 시점에 주입 — Activity 에서 `__APP_VERSION__` 으로 참조.
const rootPkg = JSON.parse(
	readFileSync(new URL("../../package.json", import.meta.url), "utf-8"),
) as {
	version: string;
};

export default defineConfig({
	plugins: [react(), tailwindcss()],
	define: {
		__APP_VERSION__: JSON.stringify(rootPkg.version),
	},
	server: {
		port: 5173,
		host: "0.0.0.0",
		// Activity iframe 은 bot.mooklol.com 으로 들어오므로 dev 시에도 nginx 프록시 통해야 함
		hmr: { clientPort: 443, protocol: "wss" },
	},
	build: {
		outDir: "dist",
		sourcemap: true,
	},
});
