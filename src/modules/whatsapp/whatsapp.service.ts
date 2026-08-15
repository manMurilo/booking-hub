import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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

/**
 * WhatsApp Service - Orchestrates AI, Booking, and Conversation State
 * Main logic for processing customer messages and generating responses
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private aiService: AIService,
    private bookingService: BookingService,
    private conversationStateService: ConversationStateService,
  ) {}

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

