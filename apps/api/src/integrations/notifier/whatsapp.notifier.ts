import { INotifier, NotificationMessage, NotificationResult } from "../../interfaces/notifier.js";
import { logger } from "../../config/logger.js";
import pRetry from "p-retry";

export class WhatsAppNotifier implements INotifier {
  async send(message: NotificationMessage): Promise<NotificationResult> {
    return pRetry(
      async () => {
        // TODO: Integrate WhatsApp Business Cloud API webhook once provider credentials are provisioned
        logger.info({ recipient: message.recipient }, "[WhatsAppNotifier] Simulated send");
        return {
          success: true,
          messageId: `wa-${Date.now()}`,
        };
      },
      { retries: 3 }
    );
  }
}
