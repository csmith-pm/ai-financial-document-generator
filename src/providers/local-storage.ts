import { writeFile, readFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { StorageProvider } from "../core/providers.js";

const DEFAULT_BASE_DIR = "/tmp/document-engine";

export interface LocalStorageProviderConfig {
  baseDir?: string;
  baseUrl?: string;
}

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;
  private baseUrl: string;

  constructor(config?: LocalStorageProviderConfig) {
    this.baseDir = config?.baseDir ?? DEFAULT_BASE_DIR;
    this.baseUrl = config?.baseUrl ?? `file://${this.baseDir}`;
  }

  async upload(
    key: string,
    buffer: Buffer,
    _contentType: string
  ): Promise<string> {
    const filePath = join(this.baseDir, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
    return key;
  }

  async getObject(key: string): Promise<Buffer> {
    const filePath = join(this.baseDir, key);
    return readFile(filePath);
  }

  async getSignedUrl(
    key: string,
    _expiresInSeconds?: number
  ): Promise<string> {
    return `${this.baseUrl}/${key}`;
  }
}
