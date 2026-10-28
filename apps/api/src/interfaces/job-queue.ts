export type JobHandler<T> = (data: T) => Promise<void>;

export interface IJobQueue<T> {
  readonly name: string;
  enqueue(data: T): Promise<void>;
  subscribe(handler: JobHandler<T>): void;
}
