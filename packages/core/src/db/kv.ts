import { getKvStore } from "../kv/factory.js";

export async function getKv(key: string): Promise<string | undefined> {
	return getKvStore().get(key);
}

export async function setKv(key: string, value: string, updatedBy?: string): Promise<void> {
	return getKvStore().set(key, value, updatedBy ? { updatedBy } : undefined);
}

export async function deleteKv(key: string): Promise<void> {
	return getKvStore().delete(key);
}
