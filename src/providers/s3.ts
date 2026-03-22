import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider } from "../core/providers.js";

const DEFAULT_SIGNED_URL_EXPIRY = 3600;

export interface S3StorageProviderConfig {
  bucket: string;
  region?: string;
}

export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor(config: S3StorageProviderConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({ region: config.region ?? "us-east-1" });
  }

  async upload(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return key;
  }

  async getObject(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
    if (!response.Body) {
      throw new Error(`S3 object not found: ${key}`);
    }
    const chunks: Uint8Array[] = [];
    const stream = response.Body as AsyncIterable<Uint8Array>;
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async getSignedUrl(
    key: string,
    expiresInSeconds?: number
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return awsGetSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds ?? DEFAULT_SIGNED_URL_EXPIRY,
    });
  }
}
