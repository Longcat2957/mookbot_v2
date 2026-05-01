import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		port: 5173,
		host: "0.0.0.0",
		// Activity iframe 은 bot.mooklol.com 으로 들어오므로 dev 시에도 nginx 프록시 통해야 함
		hmr: { clientPort: 443, protocol: "wss" },
		// 로컬 dev 시 cloudflared tunnel → vite (5173) 단일 포트로 들어옴.
		// /api, /ws, /dd 는 별도 백엔드 — vite proxy 로 forward.
		// production nginx 의 location 분배와 같은 효과.
		proxy: {
			"/api": "http://localhost:3000",
			"/ws": { target: "ws://localhost:3000", ws: true },
			"/dd": {
				target: "https://ddragon.leagueoflegends.com",
				changeOrigin: true,
				rewrite: (p) => p.replace(/^\/dd/, ""),
			},
		},
		// cloudflared *.trycloudflare.com 호스트 허용 (dev only)
		allowedHosts: [".trycloudflare.com"],
	},
	build: {
		outDir: "dist",
		sourcemap: true,
	},
});
