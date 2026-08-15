import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AIMessage,
  AIResponse,
  ConversationContext,
  AIServiceConfig,
} from './ai.types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * AI Service - Integrates with LLM (Grok, OpenAI, etc)
 * Handles message processing and conversation context
 */
@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private config: AIServiceConfig;
  private systemPrompt: string;

  constructor(private configService: ConfigService) {
    this.config = {
      apiKey: this.configService.get('GROK_API_KEY') || '',
      model: this.configService.get('GROK_MODEL', 'grok-2-1212'),
      maxTokens: parseInt(this.configService.get('AI_MAX_TOKENS', '1024')),
      temperature: parseFloat(this.configService.get('AI_TEMPERATURE', '0.7')),
    };

    // Load system prompt
    this.systemPrompt = this.loadSystemPrompt();
  }

  /**
   * Load system prompt from file
   */
  private loadSystemPrompt(): string {
    try {
      const promptPath = path.join(__dirname, 'prompts', 'system.prompt.txt');
      const prompt = fs.readFileSync(promptPath, 'utf-8');
      return prompt;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Could not load system prompt from file: ${message}`,
      );
      return 'You are a helpful WhatsApp bot assistant.';
    }
  }

  /**
   * Process a user message and generate AI response
   *
   * @param userMessage - The user's input message
   * @param conversationContext - Full conversation history and metadata
   * @returns AI response
   */
  async processMessage(
    userMessage: string,
    conversationContext: ConversationContext,
  ): Promise<AIResponse> {
    if (!userMessage || userMessage.trim().length === 0) {
      throw new BadRequestException('User message cannot be empty');
    }

    if (!this.config.apiKey) {
      throw new BadRequestException(
        'AI Service not configured (missing API key)',
      );
    }

    try {
      // Build messages array with system prompt
      const messages: AIMessage[] = [
        {
          role: 'system',
          content: this.systemPrompt,
        },
        ...conversationContext.messages,
        {
          role: 'user',
          content: userMessage,
        },
      ];

      // Call LLM (Grok/OpenAI-compatible)
      const response = await this.callLLM(messages);

      return {
        message: response,
        confidence: 0.9, // Can be enhanced based on LLM response metadata
        metadata: {
          model: this.config.model,
          conversationId: conversationContext.conversationId,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error processing message: ${message}`);
      throw new BadRequestException(`AI Service error: ${message}`);
    }
  }

  /**
   * Call the LLM API
   * Currently configured for Grok/OpenAI-compatible APIs
   *
   * @param messages - Conversation messages
   * @returns LLM response text
   */
  private async callLLM(messages: AIMessage[]): Promise<string> {
    const payload = {
      model: this.config.model,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    };

    const response = await fetch('https://api.x.ai/openai/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`LLM API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();

    // Extract message from response (compatible with Grok/OpenAI format)
    const assistantMessage = data.choices?.[0]?.message?.content;

    if (!assistantMessage) {
      throw new Error('No message in LLM response');
    }

    return assistantMessage;
  }

  /**
   * Get system prompt (for debugging/testing)
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * Reload system prompt (for dynamic updates)
   */
  reloadSystemPrompt(): void {
    this.systemPrompt = this.loadSystemPrompt();
    this.logger.log('System prompt reloaded');
  }
}
