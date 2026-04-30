import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
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
