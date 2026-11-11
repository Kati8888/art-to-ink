import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface D1Result<T = unknown> {
  results?: T[];
  success?: boolean;
  meta?: { changes?: number };
}

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

export interface R2ObjectBody {
  body: ReadableStream<Uint8Array>;
  httpMetadata?: { contentType?: string };
  size?: number;
}

export interface R2Bucket {
  head(key: string): Promise<{ key: string; size: number; httpMetadata?: { contentType?: string } } | null>;
  get(key: string): Promise<R2ObjectBody | null>;
}

export async function getCommerceBindings() {
  const { env } = await getCloudflareContext({ async: true });
  const bindings = env as unknown as {
    DB?: D1Database;
    ARTWORK_FILES?: R2Bucket;
  };
  if (!bindings.DB) throw new Error("Cloudflare D1 binding DB is not configured.");
  if (!bindings.ARTWORK_FILES) throw new Error("Cloudflare R2 binding ARTWORK_FILES is not configured.");
  return { db: bindings.DB, files: bindings.ARTWORK_FILES };
}
