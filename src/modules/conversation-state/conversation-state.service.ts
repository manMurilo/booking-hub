import { Injectable, Logger } from '@nestjs/common';
import {
  ConversationState,
  ConversationStage,
  UserIntention,
  ClientData,
  SchedulingData,
  MessageHistory,
} from './conversation-state.types';

/**
 * Serviço para gerenciar o estado da conversa do cliente
 * Rastreia:
 * - Etapa atual do fluxo
 * - Dados coletados (cliente, agendamento)
 * - Histórico de mensagens
 * - Metadados do fluxo
 */
@Injectable()
export class ConversationStateService {
  private readonly logger = new Logger(ConversationStateService.name);

  /**
   * Em produção, isso seria um banco de dados ou Redis
   * Por enquanto, usamos Map com TTL simples
   */
  private conversationStore = new Map<string, ConversationState>();

  /**
   * Cria uma nova conversa
   * @param phoneNumber - Telefone do cliente (normalizado)
   * @returns Novo estado da conversa
   */
  createConversation(phoneNumber: string): ConversationState {
    const conversationId = `${phoneNumber}_${Date.now()}`;
    const now = new Date();

    const state: ConversationState = {
      conversationId,
      phoneNumber,
      createdAt: now,
      lastMessageAt: now,
      currentStage: ConversationStage.INITIAL,
      client: { phoneNumber },
      messageHistory: [],
      oopsCount: 0,
      exaltationLevel: 0,
      canAskForMoreInfo: true,
      requiresHumanHandover: false,
    };

    this.conversationStore.set(conversationId, state);
    this.logger.log(`Conversa criada: ${conversationId}`);

    return state;
  }

  /**
   * Recupera uma conversa existente
   * @param conversationId - ID da conversa
   * @returns Estado da conversa ou undefined
   */
  getConversation(conversationId: string): ConversationState | undefined {
    return this.conversationStore.get(conversationId);
  }

  /**
   * Recupera ou cria uma conversa para um telefone
   * (Em produção, buscaria no banco de dados)
   * @param phoneNumber - Telefone do cliente
   * @returns Estado da conversa
   */
  getOrCreateConversation(phoneNumber: string): ConversationState {
    // Buscar conversa recente (últimas 24h) para este telefone
    for (const [, state] of this.conversationStore) {
      if (
        state.phoneNumber === phoneNumber &&
        Date.now() - state.lastMessageAt.getTime() < 24 * 60 * 60 * 1000
      ) {
        return state;
      }
    }

    // Criar nova conversa
    return this.createConversation(phoneNumber);
  }

  /**
   * Atualiza o estágio atual da conversa
   * @param conversationId - ID da conversa
   * @param newStage - Novo estágio
   */
  updateStage(conversationId: string, newStage: ConversationStage): void {
    const state = this.getConversation(conversationId);
    if (!state) {
      this.logger.warn(`Conversa não encontrada: ${conversationId}`);
      return;
    }

    state.previousStage = state.currentStage;
    state.currentStage = newStage;
    state.lastMessageAt = new Date();

    this.logger.debug(`Estágio atualizado: ${state.previousStage} → ${newStage}`);
  }

  /**
   * Atualiza dados do cliente
   * @param conversationId - ID da conversa
   * @param clientData - Dados a atualizar
   */
  updateClientData(conversationId: string, clientData: Partial<ClientData>): void {
    const state = this.getConversation(conversationId);
    if (!state) {
      this.logger.warn(`Conversa não encontrada: ${conversationId}`);
      return;
    }

    state.client = { ...state.client, ...clientData };
    state.lastMessageAt = new Date();
  }

  /**
   * Atualiza dados de agendamento
   * @param conversationId - ID da conversa
   * @param schedulingData - Dados a atualizar
   */
  updateSchedulingData(
    conversationId: string,
    schedulingData: Partial<SchedulingData>,
  ): void {
    const state = this.getConversation(conversationId);
    if (!state) {
      this.logger.warn(`Conversa não encontrada: ${conversationId}`);
      return;
    }

    if (!state.scheduling) {
      state.scheduling = {} as SchedulingData;
    }

    state.scheduling = { ...state.scheduling, ...schedulingData };
    state.lastMessageAt = new Date();
  }

  /**
   * Adiciona mensagem ao histórico
   * @param conversationId - ID da conversa
   * @param role - Quem enviou ('client' ou 'bot')
   * @param content - Conteúdo da mensagem
   */
  addMessageToHistory(
    conversationId: string,
    role: 'client' | 'bot',
    content: string,
  ): void {
    const state = this.getConversation(conversationId);
    if (!state) {
      this.logger.warn(`Conversa não encontrada: ${conversationId}`);
      return;
    }

    const message: MessageHistory = {
      role,
      content,
      timestamp: new Date(),
      stage: state.currentStage,
    };

    state.messageHistory.push(message);
    state.lastMessageAt = new Date();

    // Manter apenas as últimas 50 mensagens (para economizar memória)
    if (state.messageHistory.length > 50) {
      state.messageHistory = state.messageHistory.slice(-50);
    }
  }

  /**
   * Recupera histórico da conversa (opcional: últimas N mensagens)
   * @param conversationId - ID da conversa
   * @param limit - Número máximo de mensagens (0 = todas)
   * @returns Array de mensagens
   */
  getMessageHistory(conversationId: string, limit: number = 0): MessageHistory[] {
    const state = this.getConversation(conversationId);
    if (!state) {
      return [];
    }

    if (limit === 0) {
      return state.messageHistory;
    }

    return state.messageHistory.slice(-limit);
  }

  /**
   * Atualiza a intenção do usuário
   * @param conversationId - ID da conversa
   * @param intention - Intenção detectada
   */
  updateIntention(conversationId: string, intention: UserIntention): void {
    const state = this.getConversation(conversationId);
    if (!state) {
      this.logger.warn(`Conversa não encontrada: ${conversationId}`);
      return;
    }

    state.lastIntention = intention;
  }

  /**
   * Incrementa contador de mensagens fora de contexto
   * @param conversationId - ID da conversa
   * @returns Novo valor do contador
   */
  incrementOopsCount(conversationId: string): number {
    const state = this.getConversation(conversationId);
    if (!state) {
      this.logger.warn(`Conversa não encontrada: ${conversationId}`);
      return 0;
    }

    state.oopsCount = (state.oopsCount || 0) + 1;
    return state.oopsCount;
  }

  /**
   * Reseta contador de mensagens fora de contexto
   * @param conversationId - ID da conversa
   */
  resetOopsCount(conversationId: string): void {
    const state = this.getConversation(conversationId);
    if (!state) {
      this.logger.warn(`Conversa não encontrada: ${conversationId}`);
      return;
    }

    state.oopsCount = 0;
  }

  /**
   * Atualiza nível de exaltação/agressividade
   * @param conversationId - ID da conversa
   * @param level - Nível (0-10)
   */
  setExaltationLevel(conversationId: string, level: number): void {
    const state = this.getConversation(conversationId);
    if (!state) {
      this.logger.warn(`Conversa não encontrada: ${conversationId}`);
      return;
    }

    state.exaltationLevel = Math.max(0, Math.min(10, level));
  }

  /**
   * Marca conversa para encaminhamento a atendente humano
   * @param conversationId - ID da conversa
   */
  markForHumanHandover(conversationId: string): void {
    const state = this.getConversation(conversationId);
    if (!state) {
      this.logger.warn(`Conversa não encontrada: ${conversationId}`);
      return;
    }

    state.requiresHumanHandover = true;
    state.currentStage = ConversationStage.HANDOVER_TO_HUMAN;
  }

  /**
   * Reseta dados de agendamento para começar novo fluxo
   * @param conversationId - ID da conversa
   */
  resetSchedulingData(conversationId: string): void {
    const state = this.getConversation(conversationId);
    if (!state) {
      this.logger.warn(`Conversa não encontrada: ${conversationId}`);
      return;
    }

    state.scheduling = undefined;
  }

  /**
   * Marca se é uma continuação de fluxo anterior
   * @param conversationId - ID da conversa
   * @param isContinuing - true se está continuando
   */
  setContinuingPreviousFlow(conversationId: string, isContinuing: boolean): void {
    const state = this.getConversation(conversationId);
    if (!state) {
      this.logger.warn(`Conversa não encontrada: ${conversationId}`);
      return;
    }

    state.isContinuingPreviousFlow = isContinuing;
  }

  /**
   * Limpa conversa (para encerramento)
   * @param conversationId - ID da conversa
   */
  clearConversation(conversationId: string): void {
    this.conversationStore.delete(conversationId);
    this.logger.log(`Conversa limpa: ${conversationId}`);
  }

  /**
   * Obtém resumo da conversa (para logging/analytics)
   * @param conversationId - ID da conversa
   * @returns Resumo do estado
   */
  getSummary(conversationId: string): Record<string, any> {
    const state = this.getConversation(conversationId);
    if (!state) {
      return {};
    }

    return {
      conversationId: state.conversationId,
      phoneNumber: state.phoneNumber,
      currentStage: state.currentStage,
      lastIntention: state.lastIntention,
      clientIdentified: !!state.client.clientId,
      hasSchedulingData: !!state.scheduling,
      messageCount: state.messageHistory.length,
      oopsCount: state.oopsCount,
      exaltationLevel: state.exaltationLevel,
      requiresHumanHandover: state.requiresHumanHandover,
      durationMinutes: (Date.now() - state.createdAt.getTime()) / 60000,
    };
  }
}
