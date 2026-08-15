/**
 * Types for AI Service integration
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  message: string;
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface ConversationContext {
  conversationId: string;
  messages: AIMessage[];
  systemPrompt: string;
  metadata?: Record<string, any>;
}

export interface AIServiceConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}
