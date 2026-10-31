export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface WhatsAppOptions {
  to: string;
  message: string;
  templateId?: string;
  params?: Record<string, string>;
}

export interface SmsOptions {
  to: string;
  message: string;
  templateId?: string;
}

export interface INotifier {
  sendEmail(options: EmailOptions): Promise<void>;
  sendWhatsApp(options: WhatsAppOptions): Promise<void>;
  sendSms(options: SmsOptions): Promise<void>;
}
