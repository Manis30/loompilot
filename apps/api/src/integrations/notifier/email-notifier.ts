import nodemailer, { Transporter } from "nodemailer";
import {
  INotifier,
  EmailOptions,
  WhatsAppOptions,
  SmsOptions,
} from "../../interfaces/notifier.interface.js";
import { logger } from "../../utils/logger.js";

export class EmailNotifier implements INotifier {
  private transporter: Transporter;
  private defaultFrom: string;

  constructor(options: {
    host: string;
    port: number;
    user?: string;
    pass?: string;
    from: string;
  }) {
    this.defaultFrom = options.from;
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.port === 465,
      auth:
        options.user && options.pass
          ? {
              user: options.user,
              pass: options.pass,
            }
          : undefined,
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: options.from || this.defaultFrom,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      logger.info({ to: options.to, subject: options.subject }, "Email sent successfully");
    } catch (err: any) {
      logger.error({ to: options.to, err: err.message }, "Failed to send email");
      throw err;
    }
  }

  async sendWhatsApp(options: WhatsAppOptions): Promise<void> {
    // WhatsApp adapter stubbed as interface only per Stage requirements
    logger.info({ to: options.to, message: options.message }, "[STUB] WhatsApp message queued");
  }

  async sendSms(options: SmsOptions): Promise<void> {
    // SMS adapter stubbed as interface only per Stage requirements
    logger.info({ to: options.to, message: options.message }, "[STUB] SMS message queued");
  }
}
