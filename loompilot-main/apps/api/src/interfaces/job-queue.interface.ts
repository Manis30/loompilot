export interface JobOptions {
  attempts?: number;
  backoff?: {
    type: "fixed" | "exponential";
    delay: number;
  };
  delay?: number;
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
  jobId?: string;
}

export interface IJobQueue {
  addJob<T = any>(
    queueName: string,
    jobName: string,
    data: T,
    options?: JobOptions
  ): Promise<string>;

  addDelayedJob<T = any>(
    queueName: string,
    jobName: string,
    data: T,
    delayMs: number,
    options?: Omit<JobOptions, "delay">
  ): Promise<string>;

  addRepeatableJob<T = any>(
    queueName: string,
    jobName: string,
    data: T,
    cron: string,
    jobKey?: string
  ): Promise<void>;

  close(): Promise<void>;
}

