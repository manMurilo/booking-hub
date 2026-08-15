import { Injectable, Logger } from '@nestjs/common';
import {
  ConversationState,
  ConversationStage,
  UserIntention,
  ClientData,
  SchedulingData,
  MessageHistory,
} from './conversation-state.types';
import {
  ConversationContext,
  ConversationIntent,
  ConversationStep,
  PendingAction,
  ClientContextData,
  BookingContextData,
} from './conversation-flow.types';

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
  private readonly maxHistoryMessages = 50;

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
    this.logger.log(`[ConversationState] Conversa criada: ${conversationId}`);

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
    for (const [, state] of this.conversationStore) {
      if (
        state.phoneNumber === phoneNumber &&
        Date.now() - state.lastMessageAt.getTime() < 24 * 60 * 60 * 1000
      ) {
        this.logger.log(
          `[ConversationState] Conversa recuperada: ${state.conversationId}`,
        );
        return state;
      }
    }

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

    const previousStage = state.currentStage;
    state.previousStage = previousStage;
    state.currentStage = newStage;
    state.lastMessageAt = new Date();

    this.logger.log(
      `[ConversationState] Estágio atualizado:\n   ${previousStage} → ${newStage}`,
    );
  }

  /**
   * Atualiza dados do cliente
   * @param conversationId - ID da conversa
   * @param clientData - Dados a atualizar
   */
  updateClientData(
    conversationId: string,
    clientData: Partial<ClientData>,
  ): void {
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
      state.scheduling = {};
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

    if (state.messageHistory.length > this.maxHistoryMessages) {
      state.messageHistory = state.messageHistory.slice(
        -this.maxHistoryMessages,
      );
    }

    this.logger.log(
      `[ConversationState] Mensagem adicionada:\n   Conversation: ${conversationId}\n   Role: ${role.toUpperCase()}\n   Histórico: ${state.messageHistory.length}`,
    );
  }

  /**
   * Recupera histórico da conversa (opcional: últimas N mensagens)
   * @param conversationId - ID da conversa
   * @param limit - Número máximo de mensagens (0 = todas)
   * @returns Array de mensagens
   */
  getMessageHistory(
    conversationId: string,
    limit: number = 0,
  ): MessageHistory[] {
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
    state.lastMessageAt = new Date();
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
  setContinuingPreviousFlow(
    conversationId: string,
    isContinuing: boolean,
  ): void {
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

  /**
   * Converte ConversationState (tipo antigo) para ConversationContext (tipo novo)
   * Utilizado para integração com ConversationFlowOrchestrator
   *
   * @param state - Estado da conversa em formato antigo
   * @returns Contexto da conversa em formato novo
   */
  toConversationContext(state: ConversationState): ConversationContext {
    // Mapear intenção de enum antigo para novo
    let intent = ConversationIntent.UNKNOWN;
    if (state.lastIntention === UserIntention.SCHEDULE_APPOINTMENT) {
      intent = ConversationIntent.BOOKING;
    } else if (state.lastIntention === UserIntention.UNKNOWN) {
      intent = ConversationIntent.UNKNOWN;
    }
    // Nota: INQUIRY e SUPPORT ainda não mapeados, pois não existem nos enums antigos

    // Mapear estágio de enum antigo para novo
    let step = ConversationStep.INITIAL;
    if (
      state.currentStage === ConversationStage.INITIAL ||
      state.currentStage === ConversationStage.IDENTIFYING
    ) {
      step = ConversationStep.INITIAL;
    } else if (state.currentStage === ConversationStage.IDENTIFIED) {
      step = ConversationStep.CLIENT_IDENTIFICATION;
    } else if (state.currentStage === ConversationStage.REGISTERING_CPF) {
      step = ConversationStep.CLIENT_REGISTRATION;
    } else if (state.currentStage === ConversationStage.REGISTERING_NAME) {
      step = ConversationStep.CLIENT_REGISTRATION;
    } else if (state.currentStage === ConversationStage.REGISTRATION_COMPLETE) {
      step = ConversationStep.CLIENT_IDENTIFICATION;
    } else if (state.currentStage === ConversationStage.SCHEDULING_SERVICE) {
      step = ConversationStep.BOOKING_SERVICE_SELECTION;
    } else if (state.currentStage === ConversationStage.SCHEDULING_DATE) {
      step = ConversationStep.BOOKING_DATE_SELECTION;
    } else if (state.currentStage === ConversationStage.SCHEDULING_TIME) {
      step = ConversationStep.BOOKING_TIME_SELECTION;
    } else if (
      state.currentStage === ConversationStage.SCHEDULING_CONFIRMATION
    ) {
      step = ConversationStep.BOOKING_CONFIRMATION;
    } else if (state.currentStage === ConversationStage.SCHEDULING_COMPLETE) {
      step = ConversationStep.COMPLETED;
    } else if (state.currentStage === ConversationStage.HANDOVER_TO_HUMAN) {
      step = ConversationStep.HANDOVER_TO_HUMAN;
    } else if (state.currentStage === ConversationStage.CONVERSATION_END) {
      step = ConversationStep.COMPLETED;
    }

    // Construir dados do cliente
    const clientContext: ClientContextData = {
      identified: !!state.client.clientId,
      id: state.client.clientId,
      name: state.client.name,
      firstName: state.client.firstName,
      phone: state.phoneNumber,
      cpf: state.client.cpf,
      foundInDatabase: state.client.foundInDatabase,
    };

    // Construir dados de agendamento
    const bookingContext: BookingContextData | undefined = state.scheduling
      ? {
          serviceId: state.scheduling.serviceId,
          serviceName: state.scheduling.serviceName,
          professionalId: state.scheduling.professionalId,
          professionalName: state.scheduling.professionalName,
          appointmentDate: state.scheduling.appointmentDate,
          appointmentDateString: state.scheduling.appointmentDateString,
          appointmentTime: state.scheduling.appointmentTime,
          appointmentTimeSlots: state.scheduling.availableTimeSlots,
          isConfirmed: false,
          appointmentId: state.scheduling.appointmentId,
        }
      : undefined;

    // Construir contexto completo
    const context: ConversationContext = {
      conversationId: state.conversationId,
      phoneNumber: state.phoneNumber,
      intent,
      previousIntent: undefined, // Não disponível no estado antigo
      step,
      previousStep: undefined, // Mapearia previousStage se disponível
      pendingAction: PendingAction.NONE, // Será atualizado pelo orchestrator
      client: clientContext,
      booking: bookingContext,
      createdAt: state.createdAt,
      lastMessageAt: state.lastMessageAt,
      lastIntentionRecognizedAt: undefined, // Não disponível no estado antigo
      isRetryingAfterError: false,
      metadata: {
        oopsCount: state.oopsCount,
        exaltationLevel: state.exaltationLevel,
        requiresHumanHandover: state.requiresHumanHandover,
        canAskForMoreInfo: state.canAskForMoreInfo,
      },
    };

    return context;
  }

  /**
   * Atualiza ConversationState a partir de ConversationContext
   * Utilizado após orquestrador determinar próximo passo
   *
   * @param conversationId - ID da conversa
   * @param context - Contexto atualizado
   */
  updateFromConversationContext(
    conversationId: string,
    context: ConversationContext,
  ): void {
    const state = this.getConversation(conversationId);
    if (!state) {
      this.logger.warn(`Conversa não encontrada: ${conversationId}`);
      return;
    }

    // Mapear step de volta para stage antigo
    let stage = ConversationStage.INITIAL;
    switch (context.step) {
      case ConversationStep.INITIAL:
        stage = ConversationStage.INITIAL;
        break;
      case ConversationStep.AWAITING_INTENTION:
        stage = ConversationStage.IDENTIFYING;
        break;
      case ConversationStep.CLIENT_IDENTIFICATION:
        stage = ConversationStage.IDENTIFIED;
        break;
      case ConversationStep.CLIENT_REGISTRATION:
        stage = ConversationStage.REGISTERING_CPF;
        break;
      case ConversationStep.BOOKING_SERVICE_SELECTION:
        stage = ConversationStage.SCHEDULING_SERVICE;
        break;
      case ConversationStep.BOOKING_DATE_SELECTION:
        stage = ConversationStage.SCHEDULING_DATE;
        break;
      case ConversationStep.BOOKING_TIME_SELECTION:
        stage = ConversationStage.SCHEDULING_TIME;
        break;
      case ConversationStep.BOOKING_CONFIRMATION:
        stage = ConversationStage.SCHEDULING_CONFIRMATION;
        break;
      case ConversationStep.COMPLETED:
        stage = ConversationStage.CONVERSATION_END;
        break;
      case ConversationStep.HANDOVER_TO_HUMAN:
        stage = ConversationStage.HANDOVER_TO_HUMAN;
        break;
      default:
        stage = state.currentStage; // Manter estágio atual se não conseguir mapear
    }

    // Atualizar stage
    this.updateStage(conversationId, stage);

    // Atualizar dados do cliente
    if (context.client) {
      const clientUpdate: Partial<ClientData> = {
        clientId: context.client.id,
        name: context.client.name,
        firstName: context.client.firstName,
        cpf: context.client.cpf,
        foundInDatabase: context.client.foundInDatabase,
        phoneNumber: context.client.phone,
      };
      this.updateClientData(conversationId, clientUpdate);
    }

    // Atualizar dados de agendamento
    if (context.booking) {
      const bookingUpdate: Partial<SchedulingData> = {
        serviceId: context.booking.serviceId,
        serviceName: context.booking.serviceName,
        professionalId: context.booking.professionalId,
        professionalName: context.booking.professionalName,
        appointmentDate: context.booking.appointmentDate,
        appointmentDateString: context.booking.appointmentDateString,
        appointmentTime: context.booking.appointmentTime,
        appointmentId: context.booking.appointmentId,
        availableTimeSlots: context.booking.appointmentTimeSlots,
      };
      this.updateSchedulingData(conversationId, bookingUpdate);
    }

    // Atualizar metadata
    if (context.metadata) {
      state.oopsCount = context.metadata.oopsCount ?? state.oopsCount;
      state.exaltationLevel =
        context.metadata.exaltationLevel ?? state.exaltationLevel;
      state.requiresHumanHandover =
        context.metadata.requiresHumanHandover ?? state.requiresHumanHandover;
      state.canAskForMoreInfo =
        context.metadata.canAskForMoreInfo ?? state.canAskForMoreInfo;
    }

    this.logger.debug(
      `[ConversationState] Contexto atualizado via orchestrator: ${conversationId}`,
    );
  }
}
