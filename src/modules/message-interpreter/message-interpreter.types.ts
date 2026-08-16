import {
  ConversationContext,
  ConversationIntent,
} from '../conversation-state/conversation-flow.types';

export interface MessageInterpretationContext {
  conversation?: Partial<ConversationContext>;
}

export interface StructuredMessage {
  intent: ConversationIntent;
  service?: string | null;
  professional?: string | null;
  date?: string | null;
  time?: string | null;
  period?: string | null;
  customer?: {
    name?: string | null;
    phone?: string | null;
    cpf?: string | null;
  } | null;
  customerExists?: boolean | null;
  confirmation?: boolean | null;
  cancellation?: boolean | null;
  rawText: string;
  normalizedText: string;
  missingFields: string[];
  confidence: number;
}

export interface MessageInterpreter {
  interpret(
    message: string,
    context?: MessageInterpretationContext,
  ): Promise<StructuredMessage>;
}
