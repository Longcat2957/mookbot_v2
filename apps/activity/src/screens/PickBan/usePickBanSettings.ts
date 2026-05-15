import { useEffect, useState } from "react";
import type { OrderMode } from "./pickbanOrder.js";

export function useStoredBoolean(key: string, defaultValue: boolean) {
	const [value, setValue] = useState<boolean>(() => {
		try {
			return localStorage.getItem(key) !== "0";
		} catch {
			return defaultValue;
		}
	});
	useEffect(() => {
		try {
			localStorage.setItem(key, value ? "1" : "0");
		} catch {}
	}, [key, value]);
	return [value, setValue] as const;
}

export function useStoredOrderMode() {
	const [orderMode, setOrderMode] = useState<OrderMode>(() => {
		try {
			const value = localStorage.getItem("pickban:orderMode");
			return value === "lol" ? "lol" : "free";
		} catch {
			return "free";
		}
	});
	useEffect(() => {
		try {
			localStorage.setItem("pickban:orderMode", orderMode);
		} catch {}
	}, [orderMode]);
	return [orderMode, setOrderMode] as const;
}
