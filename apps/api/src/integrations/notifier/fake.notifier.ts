import { INotifier, NotificationMessage, NotificationResult } from "../../interfaces/notifier.js";
import { logger } from "../../config/logger.js";

export class FakeNotifier implements INotifier {
  async send(message: NotificationMessage): Promise<NotificationResult> {
    logger.info(
      { channel: message.channel, recipient: message.recipient, subject: message.subject },
      `[FakeNotifier] Dispatched simulated ${message.channel} notification`
    );
    return {
      success: true,
      messageId: `fake-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };
  }
}
