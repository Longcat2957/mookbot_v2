import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["**/*.{test,spec}.{ts,tsx}"],
		exclude: ["**/node_modules/**", "**/dist/**", "**/.svelte-kit/**"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			include: ["packages/core/src/**", "apps/*/src/**"],
			exclude: [
				"**/*.test.ts",
				"**/*.spec.ts",
				"**/*.d.ts",
				"**/dist/**",
				"**/index.ts",
				"**/types.ts",
			],
		},
	},
});
