import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { AIService } from '../../ai/ai.service';
import { BookingService } from '../booking/booking.service';
import { ConversationStateService } from '../conversation-state/conversation-state.service';
import { ConversationFlowOrchestrator } from '../conversation-state/conversation-flow.orchestrator';
import { WhatsAppMessage, ProcessMessageResult } from './whatsapp.types';
import { ConversationStage } from '../conversation-state/conversation-state.types';
import {
  PendingAction,
  FlowDecision,
  ConversationContext,
} from '../conversation-state/conversation-flow.types';
import { BaileysConnectionService } from '../../integrations/whatsapp/baileys-connection.service';
import { WhatsAppMessageAdapterService } from '../../integrations/whatsapp/whatsapp-message-adapter.service';
import { WhatsAppIncomingMessage } from '../../integrations/whatsapp/whatsapp-integration.types';
import { TrinksAvailabilityExecutor } from '../conversation-state/trinks-availability-executor.service';

type PendingConversationBatch = {
  conversationId: string;
  jid?: string;
  messages: WhatsAppMessage[];
  timer?: NodeJS.Timeout;
  status: 'PENDING' | 'PROCESSING';
};

/**
 * WhatsApp Service - Orchestrates AI, Booking, Conversation State, and Baileys
 * Main logic for processing customer messages and generating responses
 *
 * Responsabilidades:
 * - Receber mensagens do Baileys (via BaileysConnectionService)
 * - Normalizar e processar through conversation/AI flow
 * - Enviar respostas de volta via Baileys
 * - Manter separação clara entre transporte (Baileys) e lógica de negócio
 */
@Injectable()
export class WhatsAppService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly debounceMs = 2000;
  private readonly pendingConversations = new Map<
    string,
    PendingConversationBatch
  >();

  constructor(
    private aiService: AIService,
    private bookingService: BookingService,
    private conversationStateService: ConversationStateService,
    private conversationFlowOrchestrator: ConversationFlowOrchestrator,
    private trinksAvailabilityExecutor: TrinksAvailabilityExecutor,
    private baileysConnectionService: BaileysConnectionService,
    private messageAdapterService: WhatsAppMessageAdapterService,
  ) {}

  /**
   * Inicializar serviço ao carregar o módulo
   * Registra handlers para recebimento de mensagens do Baileys
   */
  onModuleInit(): void {
    this.logger.log('[WhatsApp Service] Inicializando...');

    // Registrar handler para recebimento de mensagens
    this.baileysConnectionService.onMessage(
      this.handleIncomingMessageFromBaileys.bind(this),
    );

    // Registrar handler para mudanças de conexão (para logs)
    this.baileysConnectionService.onConnectionStateChange((event) => {
      this.logger.log(
        `[WhatsApp Service] Estado de conexão: ${event.state} - ${event.message}`,
      );
    });

    this.logger.log('[WhatsApp Service] Inicializado e aguardando mensagens');
  }

  /**
   * Handler chamado quando Baileys recebe uma mensagem
   * Esta é a entrada de mensagens reais de WhatsApp
   */
  private async handleIncomingMessageFromBaileys(
    baileysMessage: WhatsAppIncomingMessage,
  ): Promise<void> {
    try {
      const normalizedMessage =
        this.messageAdapterService.normalizeIncomingMessage(baileysMessage);

      const whatsAppMessage: WhatsAppMessage = {
        from: normalizedMessage.from,
        text: normalizedMessage.text,
        timestamp: normalizedMessage.timestamp,
        messageId: normalizedMessage.messageId,
      };

      this.logger.log(
        `📥 WHATSAPP — MENSAGEM RECEBIDA\n   De: ${whatsAppMessage.from}`,
      );

      this.queueMessageForDebounce(whatsAppMessage, baileysMessage.jid);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `❌ WHATSAPP — ERRO AO PROCESSAR\n` +
          `   De: ${baileysMessage.sender}\n` +
          `   Erro: ${message}`,
      );

      if (baileysMessage.jid) {
        try {
          const errorMessage = `Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente mais tarde.`;
          await this.sendResponseViaBaileys(baileysMessage.jid, errorMessage);
        } catch {
          this.logger.error(
            `❌ WHATSAPP — ERRO AO ENVIAR MENSAGEM DE ERRO\n` +
              `   Para: ${baileysMessage.jid}`,
          );
        }
      }
    }
  }

  /**
   * Enviar resposta de volta para o usuário via Baileys
   */
  private async sendResponseViaBaileys(
    to: string,
    text: string,
  ): Promise<void> {
    const outgoingMessage = this.messageAdapterService.prepareOutgoingMessage(
      to,
      text,
    );
    const result =
      await this.baileysConnectionService.sendMessage(outgoingMessage);

    if (result.status === 'failed') {
      this.logger.error(
        `❌ WHATSAPP — ERRO NO ENVIO\n` +
          `   Para: ${to}\n` +
          `   Erro: ${result.error}`,
      );
      return;
    }

    this.logger.log(
      `📤 WHATSAPP — ENVIO SOLICITADO\n` +
        `   Para: ${to}\n` +
        `   Message ID: ${result.messageId || '(sem id recebido)'}`,
    );
  }

  /**
   * Process incoming WhatsApp message
   * 1. Get or create conversation
   * 2. Process with AI
   * 3. Execute booking queries based on AI decision
   * 4. Update conversation state
   * 5. Return response
   *
   * @param message - WhatsApp message
   * @returns Response to send back
   */
  processMessage(message: WhatsAppMessage): ProcessMessageResult {
    if (!message.from || !message.text) {
      throw new BadRequestException('Invalid message: missing from or text');
    }

    const phoneNormalized = this.normalizePhone(message.from);
    const conversation =
      this.conversationStateService.getOrCreateConversation(phoneNormalized);

    this.queueMessageForDebounce(message);

    return {
      conversationId: conversation.conversationId,
      aiResponse: 'Mensagem enfileirada para processamento.',
      action: 'continue',
      metadata: {
        queued: true,
        pendingMessages:
          this.pendingConversations.get(phoneNormalized)?.messages.length ?? 0,
      },
    };
  }

  private queueMessageForDebounce(
    message: WhatsAppMessage,
    jid?: string,
  ): void {
    const conversationKey = this.normalizePhone(message.from);
    const existing = this.pendingConversations.get(conversationKey);
    const pending = existing ?? {
      conversationId:
        this.conversationStateService.getOrCreateConversation(conversationKey)
          .conversationId,
      jid,
      messages: [],
      status: 'PENDING',
    };

    pending.messages.push(message);
    pending.jid = jid ?? pending.jid;

    if (pending.status === 'PROCESSING') {
      this.pendingConversations.set(conversationKey, pending);
      this.logger.log(
        `[WhatsApp] Mensagem recebida durante processamento ativo para ${pending.conversationId}`,
      );
      return;
    }

    if (pending.timer) {
      clearTimeout(pending.timer);
    }

    pending.timer = setTimeout(() => {
      void this.flushPendingTurn(conversationKey);
    }, this.debounceMs);

    this.pendingConversations.set(conversationKey, pending);

    this.logger.log(
      `[WhatsApp] AGUARDANDO MENSAGENS\n   Conversa: ${pending.conversationId}\n   Mensagens pendentes: ${pending.messages.length}`,
    );
    this.logger.log(
      `[WhatsApp] DEBOUNCE RESET\n   Conversa: ${pending.conversationId}\n   Mensagens pendentes: ${pending.messages.length}`,
    );
  }

  private async flushPendingTurn(conversationKey: string): Promise<void> {
    const pending = this.pendingConversations.get(conversationKey);

    if (!pending || pending.status === 'PROCESSING') {
      return;
    }

    pending.status = 'PROCESSING';
    pending.timer = undefined;

    const batch = [...pending.messages];
    pending.messages = [];

    this.logger.log(
      `[WhatsApp] PROCESSANDO TURNO\n   Conversa: ${pending.conversationId}\n   Mensagens: ${batch.length}`,
    );

    try {
      await this.processTurn(pending.conversationId, batch, pending.jid);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `[WhatsApp] Erro ao processar turno: ${pending.conversationId}\n   Erro: ${message}`,
      );
    } finally {
      const current = this.pendingConversations.get(conversationKey);

      if (current && current.messages.length > 0) {
        current.status = 'PENDING';
        current.timer = setTimeout(() => {
          void this.flushPendingTurn(conversationKey);
        }, this.debounceMs);
        this.logger.log(
          `[WhatsApp] DEBOUNCE RESET\n   Conversa: ${current.conversationId}\n   Mensagens pendentes: ${current.messages.length}`,
        );
      } else {
        this.pendingConversations.delete(conversationKey);
      }
    }
  }

  private async processTurn(
    conversationId: string,
    batch: WhatsAppMessage[],
    jid?: string,
  ): Promise<ProcessMessageResult> {
    const state =
      this.conversationStateService.getConversation(conversationId) ??
      this.conversationStateService.getOrCreateConversation(
        conversationId.replace(/_\d+$/, ''),
      );

    for (const message of batch) {
      this.conversationStateService.addMessageToHistory(
        state.conversationId,
        'client',
        message.text,
      );
    }

    this.logger.log(
      `[FlowOrchestrator] INICIANDO ORQUESTRAÇÃO\n   Conversa: ${state.conversationId}\n   Step atual: ${state.currentStage}`,
    );

    // Converter ConversationState para ConversationContext (novo)
    const conversationContext =
      this.conversationStateService.toConversationContext(state);

    // Chamar orchestrator para determinar próximo passo
    const flowDecision =
      this.conversationFlowOrchestrator.determineNextStep(conversationContext);

    this.logger.log(
      `[FlowOrchestrator] DECISÃO\n   Conversa: ${state.conversationId}\n   Próximo step: ${flowDecision.nextStep}\n   Ação: ${flowDecision.action}`,
    );

    // Processar a decisão do orchestrator e executar operações Trinks quando necessário
    const nextContext = await this.processFlowDecision(
      state.conversationId,
      flowDecision,
      conversationContext,
    );

    const responseText = nextContext.responseText;

    // Atualizar estado da conversa a partir do contexto processado
    const updatedContext = {
      ...conversationContext,
      ...nextContext.context,
      step: nextContext.context.step,
      pendingAction: nextContext.context.pendingAction,
    };
    this.conversationStateService.updateFromConversationContext(
      state.conversationId,
      updatedContext,
    );

    // Adicionar resposta ao histórico
    this.conversationStateService.addMessageToHistory(
      state.conversationId,
      'bot',
      responseText,
    );

    // Manter compatibilidade com resultado existente
    const action =
      flowDecision.action === PendingAction.HANDOVER
        ? 'escalate'
        : flowDecision.action === PendingAction.FINISH
          ? 'complete'
          : 'continue';

    const result: ProcessMessageResult = {
      conversationId: state.conversationId,
      aiResponse: responseText,
      action,
      metadata: {
        stage: flowDecision.nextStep,
        messageCount: this.conversationStateService.getMessageHistory(
          state.conversationId,
        ).length,
        flowAction: flowDecision.action,
      },
    };

    if (jid) {
      await this.sendResponseViaBaileys(jid, responseText);
    }

    return result;
  }

  /**
   * Processa a decisão de fluxo retornada pelo orquestrador
   * Trata as ações básicas e retorna a mensagem a enviar
   *
   * @param conversationId - ID da conversa
   * @param decision - Decisão do orquestrador
   * @returns Mensagem a enviar ao usuário
   */
  private async processFlowDecision(
    conversationId: string,
    decision: FlowDecision,
    context: ConversationContext,
  ): Promise<{ responseText: string; context: ConversationContext }> {
    const { action, messageToUser } = decision;

    switch (action) {
      case PendingAction.ASK_USER:
        return {
          responseText: messageToUser || 'Como posso te ajudar?',
          context: {
            ...context,
            step: decision.nextStep,
            pendingAction: action,
          },
        };

      case PendingAction.WAIT_USER_RESPONSE:
        return {
          responseText: '',
          context: {
            ...context,
            step: decision.nextStep,
            pendingAction: action,
          },
        };

      case PendingAction.CONFIRM:
        return {
          responseText: messageToUser || 'Confirme os dados, por favor.',
          context: {
            ...context,
            step: decision.nextStep,
            pendingAction: action,
          },
        };

      case PendingAction.HANDOVER:
        this.conversationStateService.markForHumanHandover(conversationId);
        return {
          responseText: messageToUser || 'Vou conectar você com uma atendente.',
          context: {
            ...context,
            step: decision.nextStep,
            pendingAction: action,
          },
        };

      case PendingAction.FINISH:
        return {
          responseText: messageToUser || 'Conversa finalizada. Obrigado!',
          context: {
            ...context,
            step: decision.nextStep,
            pendingAction: action,
          },
        };

      case PendingAction.CONSULT_TRINKS: {
        const operation = decision.trinksOperation?.operation;
        this.logger.log(
          `[FlowOrchestrator] Operação Trinks identificada: ${operation}`,
        );

        if (operation === 'GET_AVAILABILITY') {
          const availabilityResult =
            await this.trinksAvailabilityExecutor.executeAvailability(
              context,
              decision.trinksOperation?.params ?? {},
            );

          return {
            responseText: availabilityResult.responseText,
            context: availabilityResult.context,
          };
        }

        return {
          responseText:
            messageToUser ||
            'Consultando informações... Um momento, por favor.',
          context: {
            ...context,
            step: decision.nextStep,
            pendingAction: action,
          },
        };
      }

      case PendingAction.EXECUTE_TRINKS_ACTION:
        this.logger.log(
          `[FlowOrchestrator] Ação Trinks identificada: ${decision.trinksOperation?.operation}`,
        );
        return {
          responseText:
            messageToUser ||
            'Processando sua solicitação... Um momento, por favor.',
          context: {
            ...context,
            step: decision.nextStep,
            pendingAction: action,
          },
        };

      case PendingAction.NONE:
      default:
        return {
          responseText: messageToUser || 'Pronto. Qual é o próximo passo?',
          context: {
            ...context,
            step: decision.nextStep,
            pendingAction: action,
          },
        };
    }
  }

  /**
   * Normalize phone number to consistent format
   * @param phone - Raw phone from WhatsApp
   * @returns Normalized phone
   */
  private normalizePhone(phone: string): string {
    // Remove any non-digit characters
    const digits = phone.replace(/\D/g, '');

    // If it has 55 (country code), keep it
    // Otherwise prepend 55
    if (digits.startsWith('55')) {
      return digits;
    }

    return '55' + digits;
  }

  /**
   * Determine next action based on message and AI response
   * Can be enhanced to use NLU/intent extraction
   *
   * @param userMessage - User's message
   * @param aiResponse - AI's response
   * @param conversation - Current conversation state
   * @returns Action to take
   */
  private determineNextAction(
    userMessage: string,
    aiResponse: string,
  ): 'continue' | 'escalate' | 'complete' {
    const messageLower = userMessage.toLowerCase();

    // Escalate if user explicitly asks for human
    if (
      messageLower.includes('atendente') ||
      messageLower.includes('humano') ||
      messageLower.includes('falar com') ||
      messageLower.includes('suporte')
    ) {
      return 'escalate';
    }

    // Check if AI detected escalation need (if response contains escalation keywords)
    if (
      aiResponse.includes('encaminhar') ||
      aiResponse.includes('atendente') ||
      aiResponse.includes('representante')
    ) {
      return 'escalate';
    }

    // Check for conversation end
    if (
      messageLower === 'sair' ||
      messageLower === 'encerrar' ||
      messageLower === 'fim'
    ) {
      return 'complete';
    }

    // Default to continue
    return 'continue';
  }

  /**
   * Get next conversation stage based on current action
   * @param currentStage - Current stage
   * @param action - Action to take
   * @returns Next stage
   */
  private getNextStage(
    currentStage: ConversationStage,
    action: 'continue' | 'escalate' | 'complete',
  ): ConversationStage {
    if (action === 'escalate') {
      return ConversationStage.HANDOVER_TO_HUMAN;
    }

    if (action === 'complete') {
      return ConversationStage.CONVERSATION_END;
    }

    // In a real system, would use NLU to determine exact next stage
    // For now, advance based on current stage
    switch (currentStage) {
      case ConversationStage.INITIAL:
        return ConversationStage.IDENTIFYING;
      case ConversationStage.IDENTIFYING:
        return ConversationStage.IDENTIFIED;
      case ConversationStage.IDENTIFIED:
        return ConversationStage.REGISTERING_CPF;
      case ConversationStage.REGISTERING_CPF:
        return ConversationStage.REGISTERING_NAME;
      case ConversationStage.REGISTERING_NAME:
        return ConversationStage.REGISTRATION_COMPLETE;
      case ConversationStage.REGISTRATION_COMPLETE:
        return ConversationStage.SCHEDULING_SERVICE;
      default:
        return currentStage;
    }
  }

  /**
   * Get conversation summary for display
   * @param conversationId - Conversation ID
   * @returns Summary object
   */
  getConversationSummary(conversationId: string): any {
    return this.conversationStateService.getSummary(conversationId);
  }

  onModuleDestroy(): void {
    for (const pending of this.pendingConversations.values()) {
      if (pending.timer) {
        clearTimeout(pending.timer);
      }
    }
    this.pendingConversations.clear();
  }
}
