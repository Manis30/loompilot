import { logger } from "../config/logger.js";

export class JobScheduler {
  private timers: NodeJS.Timeout[] = [];

  startDailySweep(sweepFn: () => Promise<void>, intervalMs: number = 3600000): void {
    logger.info({ intervalMs }, "Started periodic monitoring sweep scheduler");
    const timer = setInterval(async () => {
      try {
        await sweepFn();
      } catch (err: any) {
        logger.error({ error: err.message }, "Error during scheduled monitoring sweep");
      }
    }, intervalMs);
    this.timers.push(timer);
  }

  stop(): void {
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    this.timers = [];
    logger.info("Job scheduler stopped");
  }
}

export const jobScheduler = new JobScheduler();

