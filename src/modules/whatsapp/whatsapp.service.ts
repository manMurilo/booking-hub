import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { AIService } from '../../ai/ai.service';
import { AIMessage } from '../../ai/ai.types';
import { BookingService } from '../booking/booking.service';
import { ConversationStateService } from '../conversation-state/conversation-state.service';
import {
  WhatsAppMessage,
  WhatsAppResponse,
  ProcessMessageResult,
} from './whatsapp.types';
import {
  ConversationStage,
  UserIntention,
} from '../conversation-state/conversation-state.types';
import { BaileysConnectionService } from '../../integrations/whatsapp/baileys-connection.service';
import { WhatsAppMessageAdapterService } from '../../integrations/whatsapp/whatsapp-message-adapter.service';
import { WhatsAppIncomingMessage } from '../../integrations/whatsapp/whatsapp-integration.types';

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
    private baileysConnectionService: BaileysConnectionService,
    private messageAdapterService: WhatsAppMessageAdapterService,
  ) {}

  /**
   * Inicializar serviço ao carregar o módulo
   * Registra handlers para recebimento de mensagens do Baileys
   */
  async onModuleInit(): Promise<void> {
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
        } catch (sendError) {
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
  async processMessage(
    message: WhatsAppMessage,
  ): Promise<ProcessMessageResult> {
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
        return;
      }

      this.pendingConversations.delete(conversationKey);
    }
  }

  private async processTurn(
    conversationId: string,
    batch: WhatsAppMessage[],
    jid?: string,
  ): Promise<ProcessMessageResult> {
    const conversation =
      this.conversationStateService.getConversation(conversationId);
    const state =
      conversation ??
      this.conversationStateService.getOrCreateConversation(
        conversationId.replace(/_\d+$/, ''),
      );

    const previousHistory = this.conversationStateService.getMessageHistory(
      state.conversationId,
    );

    for (const message of batch) {
      this.conversationStateService.addMessageToHistory(
        state.conversationId,
        'client',
        message.text,
      );
    }

    const userMessageText = batch
      .map((message) => message.text.trim())
      .filter(Boolean)
      .join(' ');

    const conversationContext = {
      conversationId: state.conversationId,
      messages: previousHistory.map((msg): AIMessage => ({
        role:
          msg.role === 'client'
            ? 'user'
            : msg.role === 'bot'
              ? 'assistant'
              : 'user',
        content: msg.content,
      })),
      systemPrompt: this.aiService.getSystemPrompt(),
      metadata: {
        stage: state.currentStage,
        intention: state.lastIntention,
        customerName: state.client?.firstName,
        clientData: state.client,
        schedulingData: state.scheduling,
        recentHistory: this.conversationStateService
          .getMessageHistory(state.conversationId)
          .slice(-10),
      },
    };

    this.logger.log(
      `[AI] PROCESSANDO TURNO\n   Conversa: ${state.conversationId}\n   Mensagens agrupadas: ${batch.length}`,
    );

    const aiResult = await this.aiService.processMessage(
      userMessageText,
      conversationContext,
    );

    this.conversationStateService.addMessageToHistory(
      state.conversationId,
      'bot',
      aiResult.message,
    );

    const action = this.determineNextAction(
      userMessageText,
      aiResult.message,
      state,
    );

    if (action === 'escalate') {
      this.conversationStateService.markForHumanHandover(state.conversationId);
    }

    const nextStage = this.getNextStage(state.currentStage, action);
    this.conversationStateService.updateStage(state.conversationId, nextStage);

    const result: ProcessMessageResult = {
      conversationId: state.conversationId,
      aiResponse: aiResult.message,
      action,
      metadata: {
        stage: state.currentStage,
        messageCount: this.conversationStateService.getMessageHistory(
          state.conversationId,
        ).length,
      },
    };

    if (jid) {
      await this.sendResponseViaBaileys(jid, aiResult.message);
    }

    return result;
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
    conversation: any,
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
