import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
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
      this.logger.log(`[WhatsApp Service] Estado de conexão: ${event.state} - ${event.message}`);
    });

    this.logger.log('[WhatsApp Service] Inicializado e aguardando mensagens');
  }

  /**
   * Handler chamado quando Baileys recebe uma mensagem
   * Esta é a entrada de mensagens reais de WhatsApp
   */
  private async handleIncomingMessageFromBaileys(baileysMessage: WhatsAppIncomingMessage): Promise<void> {
    try {
      // Normalizar mensagem do Baileys para formato interno
      const normalizedMessage = this.messageAdapterService.normalizeIncomingMessage(
        baileysMessage,
      );

      // Converter para formato esperado pelo WhatsAppService
      const whatsAppMessage: WhatsAppMessage = {
        from: normalizedMessage.from,
        text: normalizedMessage.text,
        timestamp: normalizedMessage.timestamp,
        messageId: normalizedMessage.messageId,
      };

      // Log de processamento iniciado
      this.logger.log(
        `⚙️  WHATSAPP — PROCESSANDO\n` +
        `   De: ${whatsAppMessage.from}`,
      );

      // Processar através do fluxo normal
      const result = await this.processMessage(whatsAppMessage);

      // Log de resposta gerada
      this.logger.log(
        `🤖 AI — RESPOSTA GERADA\n` +
        `   Para: ${whatsAppMessage.from}\n` +
        `   Resposta: "${result.aiResponse.substring(0, 100)}${result.aiResponse.length > 100 ? '...' : ''}"`,
      );

      // Enviar resposta de volta usando o JID original da conversa
      await this.sendResponseViaBaileys(baileysMessage.jid, result.aiResponse);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `❌ WHATSAPP — ERRO AO PROCESSAR\n` +
        `   De: ${baileysMessage.sender}\n` +
        `   Erro: ${message}`,
      );
      
      // Enviar mensagem de erro para o mesmo JID da conversa
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
  private async sendResponseViaBaileys(to: string, text: string): Promise<void> {
    const outgoingMessage = this.messageAdapterService.prepareOutgoingMessage(to, text);
    const result = await this.baileysConnectionService.sendMessage(outgoingMessage);

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
  async processMessage(message: WhatsAppMessage): Promise<ProcessMessageResult> {
    if (!message.from || !message.text) {
      throw new BadRequestException('Invalid message: missing from or text');
    }

    // Normalize phone number for consistency
    const phoneNormalized = this.normalizePhone(message.from);

    try {
      // Get or create conversation
      const conversation =
        this.conversationStateService.getOrCreateConversation(phoneNormalized);

      const conversationId = conversation.conversationId;

      // Add user message to history
      this.conversationStateService.addMessageToHistory(
        conversationId,
        'client',
        message.text,
      );

      // Prepare context for AI - convert to AIMessage format
      const messageHistory = conversation.messageHistory.map(
        (msg): AIMessage => ({
          role:
            msg.role === 'client'
              ? 'user'
              : msg.role === 'bot'
                ? 'assistant'
                : 'user',
          content: msg.content,
        }),
      );

      const conversationContext = {
        conversationId,
        messages: messageHistory,
        systemPrompt: this.aiService.getSystemPrompt(),
        metadata: {
          stage: conversation.currentStage,
          intention: conversation.lastIntention,
          customerName: conversation.client?.firstName,
        },
      };

      // Process message with AI
      const aiResult = await this.aiService.processMessage(
        message.text,
        conversationContext,
      );

      // Add AI response to history
      this.conversationStateService.addMessageToHistory(
        conversationId,
        'bot',
        aiResult.message,
      );

      // Determine next stage and actions based on AI response
      const action = this.determineNextAction(
        message.text,
        aiResult.message,
        conversation,
      );

      // Execute any required booking queries
      // (This will be enhanced based on AI intent extraction)
      if (action === 'escalate') {
        this.conversationStateService.markForHumanHandover(conversationId);
        this.logger.log(`Conversation ${conversationId} marked for escalation`);
      }

      // Update conversation state
      const nextStage = this.getNextStage(conversation.currentStage, action);
      this.conversationStateService.updateStage(conversationId, nextStage);

      return {
        conversationId,
        aiResponse: aiResult.message,
        action,
        metadata: {
          stage: conversation.currentStage,
          messageCount: conversation.messageHistory.length,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error processing message: ${message}`);
      throw new BadRequestException(`Message processing failed: ${message}`);
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
}

