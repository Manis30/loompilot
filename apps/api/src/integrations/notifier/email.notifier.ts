import { INotifier, NotificationMessage, NotificationResult } from "../../interfaces/notifier.js";
import { logger } from "../../config/logger.js";
import pRetry from "p-retry";

export class EmailNotifier implements INotifier {
  async send(message: NotificationMessage): Promise<NotificationResult> {
    return pRetry(
      async () => {
        // TODO: Integrate SMTP / SendGrid client once production email domain is verified
        logger.info({ recipient: message.recipient, subject: message.subject }, "[EmailNotifier] Simulated send");
        return {
          success: true,
          messageId: `email-${Date.now()}`,
        };
      },
      { retries: 3 }
    );
  }
}
