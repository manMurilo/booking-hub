import { Module } from '@nestjs/common';
import { ConversationStateService } from './conversation-state.service';
import { ConversationFlowOrchestrator } from './conversation-flow.orchestrator';
import { TrinksAvailabilityExecutor } from './trinks-availability-executor.service';
import { TrinksModule } from '../../integrations/trinks/trinks.module';

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
  imports: [TrinksModule],
  providers: [
    ConversationStateService,
    ConversationFlowOrchestrator,
    TrinksAvailabilityExecutor,
  ],
  exports: [
    ConversationStateService,
    ConversationFlowOrchestrator,
    TrinksAvailabilityExecutor,
  ],
})
export class ConversationStateModule {}
