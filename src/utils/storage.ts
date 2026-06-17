import fs from "node:fs/promises";
import path from "node:path";
import { uploadDirAbs } from "../config/env";

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
  // Placeholder for aws-sdk v3/minio implementation in production.
  async upload(_key: string, _content: Buffer): Promise<string> {
    throw new Error("S3 adapter not configured. Inject production credentials and bucket policy.");
  }
}

export const storageAdapter: StorageAdapter = process.env.NODE_ENV === "production"
  ? new S3CompatibleAdapter()
  : new LocalStorageAdapter();
