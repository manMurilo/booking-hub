import { Module } from '@nestjs/common';
import { ConversationStateService } from './conversation-state.service';

/**
 * Módulo de Gerenciamento de Estado de Conversa
 * Fornece serviço para rastrear o estado do fluxo conversacional com o cliente
 * 
 * Funcionalidades:
 * - Criar/recuperar conversas
 * - Rastrear etapas do fluxo
 * - Armazenar dados coletados (cliente, agendamento)
 * - Manter histórico de mensagens
 * - Gerenciar intenções e contexto
 */
@Module({
  providers: [ConversationStateService],
  exports: [ConversationStateService],
})
export class ConversationStateModule {}
