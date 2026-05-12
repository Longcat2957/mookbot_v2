/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_DISCORD_CLIENT_ID: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

// vite.config.ts 의 define 으로 빌드 시점에 주입되는 상수.
declare const __APP_VERSION__: string;
