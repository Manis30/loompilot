export interface NotificationMessage {
  recipient: string;
  subject?: string;
  body: string;
  channel: "whatsapp" | "sms" | "email";
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface INotifier {
  send(message: NotificationMessage): Promise<NotificationResult>;
}

