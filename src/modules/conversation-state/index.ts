/**
 * Índice de exportação para o módulo de Conversation State
 * Facilita importações ao centralizar as exportações
 */

// Serviços
export { ConversationStateService } from './conversation-state.service';
export { ConversationFlowOrchestrator } from './conversation-flow.orchestrator';

// Tipos originais (compatibilidade)
export {
  ConversationState,
  ConversationStage,
  UserIntention,
  ClientData,
  SchedulingData,
  MessageHistory,
  BotResponse,
} from './conversation-state.types';

// Tipos de fluxo novo
export {
  ConversationIntent,
  ConversationStep,
  PendingAction,
  ClientContextData,
  BookingContextData,
  ConversationContext,
  FlowDecision,
  FlowAdvanceResult,
} from './conversation-flow.types';

// Módulo
export { ConversationStateModule } from './conversation-state.module';
