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
      apiKey: this.configService.get('GEMINI_API_KEY') || '',
      model: this.configService.get('GEMINI_MODEL', 'gemini-3.5-flash'),
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
      this.logger.warn(`Could not load system prompt from file: ${message}`);
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
   * Call the LLM API using Google Gemini Interactions API
   * Sends conversation history and gets AI response
   *
   * @param messages - Conversation messages
   * @returns LLM response text
   */
  private async callLLM(messages: AIMessage[]): Promise<string> {
    // Build conversation history for Interactions API
    // Gemini Interactions API expects messages in parts format
    const contents = messages.map((msg) => ({
      role:
        msg.role === 'system' || msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    // Interactions API payload
    const payload = {
      contents: contents,
      generationConfig: {
        temperature: this.config.temperature,
        maxOutputTokens: this.config.maxTokens,
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_ONLY_HIGH',
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_ONLY_HIGH',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_ONLY_HIGH',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_ONLY_HIGH',
        },
      ],
    };

    this.logger.debug(
      `[AI] Enviando para Gemini Interactions API: model=${this.config.model}, tokens=${this.config.maxTokens}, messages=${messages.length}`,
    );

    // Use Interactions API endpoint
    const url = `https://generativelanguage.googleapis.com/v1/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage =
          errorData?.error?.message || errorData?.error || response.statusText;

        // Handle specific error types
        if (errorMessage && typeof errorMessage === 'string') {
          if (
            errorMessage.includes('API_KEY_INVALID') ||
            errorMessage.includes('UNAUTHENTICATED')
          ) {
            this.logger.error(
              '[AI] Erro de autenticação: API key inválida ou expirada',
            );
            throw new Error('Authentication error: Invalid or expired API key');
          }
          if (
            errorMessage.includes('not found') ||
            errorMessage.includes('no longer available')
          ) {
            this.logger.error(
              `[AI] Modelo não disponível: ${this.config.model}`,
            );
            throw new Error(
              `Model "${this.config.model}" is not available. Verify model name at https://ai.google.dev/`,
            );
          }
          if (
            errorMessage.includes('QUOTA_EXCEEDED') ||
            errorMessage.includes('RATE_LIMIT_EXCEEDED')
          ) {
            this.logger.error('[AI] Cota ou rate limit excedido');
            throw new Error('API quota or rate limit exceeded');
          }
        }

        this.logger.error(
          `[AI] Erro da API Gemini (${response.status}): ${errorMessage}`,
        );
        throw new Error(`LLM API error: ${errorMessage}`);
      }

      const data = await response.json();

      // Extract response from Interactions API format
      // Priority: output_text > candidates[0].content.parts[0].text
      const assistantMessage =
        data.output_text || data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!assistantMessage) {
        this.logger.error(
          `[AI] Resposta sem conteúdo: ${JSON.stringify(data)}`,
        );
        throw new Error('No message in LLM response');
      }

      this.logger.debug(
        `[AI] Resposta recebida do Gemini: ${assistantMessage.substring(0, 50)}...`,
      );
      return assistantMessage;
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes('fetch failed') ||
          error.message.includes('ECONNREFUSED')
        ) {
          this.logger.error(
            '[AI] Erro de conexão: não conseguiu conectar à API Gemini',
          );
          throw new Error('Network error: Could not connect to Gemini API');
        }
        this.logger.error(`[AI] Erro ao chamar Gemini: ${error.message}`);
        throw error;
      }
      throw new Error('Unknown error calling Gemini API');
    }
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
