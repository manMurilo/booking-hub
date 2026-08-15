import { Module } from '@nestjs/common';
import { ConversationStateService } from './conversation-state.service';
import { ConversationFlowOrchestrator } from './conversation-flow.orchestrator';

/**
 * Módulo de Gerenciamento de Estado de Conversa
 * Fornece serviços para rastrear e orquestrar o fluxo conversacional com o cliente
 *
 * Funcionalidades:
 * - Criar/recuperar conversas
 * - Rastrear etapas do fluxo
 * - Armazenar dados coletados (cliente, agendamento)
 * - Manter histórico de mensagens
 * - Gerenciar intenções e contexto
 * - Determinar próximo passo do fluxo (orquestração)
 */
@Module({
  providers: [ConversationStateService, ConversationFlowOrchestrator],
  exports: [ConversationStateService, ConversationFlowOrchestrator],
})
export class ConversationStateModule {}
