import { Queue, Worker } from "bullmq";
import type { QueueProvider } from "../core/providers.js";

const DEFAULT_QUEUE_NAME = "budget-book-generation";

export interface BullMQQueueProviderConfig {
  redisUrl: string;
  queueName?: string;
  concurrency?: number;
  lockDuration?: number;
}

export class BullMQQueueProvider implements QueueProvider {
  private queue: Queue;
  private redisUrl: string;
  private queueName: string;
  private concurrency: number;
  private lockDuration: number;
  private workers: Worker[] = [];

  constructor(config: BullMQQueueProviderConfig) {
    this.redisUrl = config.redisUrl;
    this.queueName = config.queueName ?? DEFAULT_QUEUE_NAME;
    this.concurrency = config.concurrency ?? 1;
    this.lockDuration = config.lockDuration ?? 1_800_000; // 30 min

    this.queue = new Queue(this.queueName, {
      connection: { url: this.redisUrl },
    });
  }

  async enqueue(
    jobType: string,
    payload: Record<string, unknown>
  ): Promise<string> {
    const job = await this.queue.add(jobType, payload);
    return job.id ?? `job-${Date.now()}`;
  }

  process(
    jobType: string,
    handler: (payload: Record<string, unknown>) => Promise<void>
  ): void {
    const worker = new Worker(
      this.queueName,
      async (job) => {
        if (job.name === jobType) {
          await handler(job.data as Record<string, unknown>);
        }
      },
      {
        connection: { url: this.redisUrl },
        concurrency: this.concurrency,
        lockDuration: this.lockDuration,
      }
    );
    this.workers.push(worker);
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()));
    await this.queue.close();
  }
}
