import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/exo-2/latin-500.css";
import "./index.css";
import { App } from "./App.js";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
