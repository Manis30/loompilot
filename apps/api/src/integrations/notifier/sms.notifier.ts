import { INotifier, NotificationMessage, NotificationResult } from "../../interfaces/notifier.js";
import { logger } from "../../config/logger.js";
import pRetry from "p-retry";

export class SmsNotifier implements INotifier {
  async send(message: NotificationMessage): Promise<NotificationResult> {
    return pRetry(
      async () => {
        // TODO: Integrate SMS gateway (e.g. Twilio/Karix) once DLT registration is approved
        logger.info({ recipient: message.recipient }, "[SmsNotifier] Simulated send");
        return {
          success: true,
          messageId: `sms-${Date.now()}`,
        };
      },
      { retries: 3 }
    );
  }
}
