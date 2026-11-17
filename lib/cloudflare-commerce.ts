import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface D1Result<T = unknown> { results?: T[]; success?: boolean; meta?: { changes?: number } }
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
export interface D1Database {
  prepare(query: string): D1Statement;
  batch<T = unknown>(statements: D1Statement[]): Promise<D1Result<T>[]>;
}
export interface KVObjectMetadata {
  contentType?: string;
  byteSize?: number;
  [key: string]: unknown;
}
export interface KVNamespace {
  get(key: string, type: "stream"): Promise<ReadableStream<Uint8Array> | null>;
  getWithMetadata(key: string, type: "stream"): Promise<{ value: ReadableStream<Uint8Array> | null; metadata: KVObjectMetadata | null }>;
}
export interface PrivateFile {
  body: ReadableStream<Uint8Array>;
  size?: number;
  httpMetadata?: { contentType?: string };
}
export interface PrivateFileStore {
  head(key: string): Promise<{ key: string; size: number; httpMetadata?: { contentType?: string } } | null>;
  get(key: string): Promise<PrivateFile | null>;
}

function createPrivateFileStore(kv: KVNamespace): PrivateFileStore {
  return {
    async head(key) {
      const result = await kv.getWithMetadata(key, "stream");
      if (!result.value) return null;

      // Older uploads stored the variant label under metadata.size, not the byte count.
      // Prefer byteSize on corrected uploads; otherwise count the existing private stream.
      let byteSize = typeof result.metadata?.byteSize === "number" ? result.metadata.byteSize : 0;
      if (byteSize <= 0) {
        const reader = result.value.getReader();
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            byteSize += chunk.value.byteLength;
          }
        } finally {
          reader.releaseLock();
        }
      } else {
        await result.value.cancel();
      }

      if (byteSize <= 0) return null;
      return { key, size: byteSize, httpMetadata: { contentType: result.metadata?.contentType } };
    },
    async get(key) {
      const result = await kv.getWithMetadata(key, "stream");
      if (!result.value) return null;
      return {
        body: result.value,
        size: typeof result.metadata?.byteSize === "number" ? result.metadata.byteSize : undefined,
        httpMetadata: { contentType: result.metadata?.contentType },
      };
    },
  };
}

export async function getCommerceBindings() {
  const { env } = await getCloudflareContext({ async: true });
  const bindings = env as unknown as { DB?: D1Database; ARTWORK_FILES?: KVNamespace };
  if (!bindings.DB) throw new Error("Cloudflare D1 binding DB is not configured.");
  if (!bindings.ARTWORK_FILES) throw new Error("Cloudflare KV binding ARTWORK_FILES is not configured.");
  return { db: bindings.DB, files: createPrivateFileStore(bindings.ARTWORK_FILES) };
}
