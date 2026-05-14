export interface KvSetOptions {
	ttlSec?: number;
	updatedBy?: string;
}

export interface KvStore {
	get(key: string): Promise<string | undefined>;
	set(key: string, value: string, opts?: KvSetOptions): Promise<void>;
	delete(key: string): Promise<void>;
}
