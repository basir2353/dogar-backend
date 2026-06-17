import fs from "node:fs/promises";
import path from "node:path";
import { env, uploadDirAbs } from "../config/env";

export interface StorageAdapter {
  upload(key: string, content: Buffer): Promise<string>;
}

export class LocalStorageAdapter implements StorageAdapter {
  async upload(key: string, content: Buffer): Promise<string> {
    const fullPath = path.join(uploadDirAbs, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
    return `/uploads/${key}`;
  }
}

export class S3CompatibleAdapter implements StorageAdapter {
  async upload(_key: string, _content: Buffer): Promise<string> {
    throw new Error("S3 adapter not configured. Set STORAGE_DRIVER=local or wire S3 credentials.");
  }
}

export const storageAdapter: StorageAdapter =
  env.STORAGE_DRIVER === "s3" ? new S3CompatibleAdapter() : new LocalStorageAdapter();
