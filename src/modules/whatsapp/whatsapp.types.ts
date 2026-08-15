/**
 * Types for WhatsApp integration
 */

export interface WhatsAppMessage {
  from: string; // Phone number without +
  text: string;
  timestamp?: number;
  messageId?: string;
}

export interface WhatsAppResponse {
  to: string;
  text: string;
  type?: string;
}

export interface WhatsAppWebhookEvent {
  object?: string;
  entry?: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          text?: {
            body: string;
          };
          type: string;
        }>;
        contacts?: Array<{
          profile: {
            name: string;
          };
          wa_id: string;
        }>;
      };
    }>;
  }>;
}

export interface ProcessMessageResult {
  conversationId: string;
  aiResponse: string;
  action?: 'continue' | 'escalate' | 'complete';
  metadata?: Record<string, any>;
}
