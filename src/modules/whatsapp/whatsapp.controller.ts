import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  Logger,
  BadRequestException,
  UseFilters,
} from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import {
  WhatsAppMessage,
  WhatsAppWebhookEvent,
  ProcessMessageResult,
} from './whatsapp.types';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { BaileysConnectionService } from '../../integrations/whatsapp/baileys-connection.service';

/**
 * WhatsApp Controller - Handles webhook and API endpoints
 * Receives WhatsApp messages and processes them
 */
@Controller('whatsapp')
@UseFilters(HttpExceptionFilter)
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private whatsAppService: WhatsAppService,
    private baileysConnectionService: BaileysConnectionService,
  ) {}

  /**
   * Webhook endpoint for WhatsApp messages
   * Called by WhatsApp when a message is received
   *
   * POST /api/whatsapp/webhook
   */
  @Post('webhook')
  async receiveMessage(@Body() event: WhatsAppWebhookEvent): Promise<any> {
    if (!event.entry || event.entry.length === 0) {
      this.logger.warn('Received empty webhook event');
      return { status: 'ok' }; // Still return 200 to avoid retries
    }

    try {
      // Process each message in the webhook event
      const results: ProcessMessageResult[] = [];

      for (const entry of event.entry) {
        for (const change of entry.changes) {
          const messages = change.value.messages;

          if (!messages || messages.length === 0) {
            continue; // Skip if no messages (e.g., status update)
          }

          // Process each message
          for (const msg of messages) {
            // Only process text messages
            if (msg.type !== 'text' || !msg.text?.body) {
              this.logger.debug(`Skipping non-text message: ${msg.type}`);
              continue;
            }

            const whatsAppMessage: WhatsAppMessage = {
              from: msg.from,
              text: msg.text.body,
              timestamp: parseInt(msg.timestamp),
              messageId: msg.id,
            };

            try {
              const result = await this.whatsAppService.processMessage(
                whatsAppMessage,
              );
              results.push(result);
              this.logger.log(
                `Processed message from ${msg.from}: ${result.conversationId}`,
              );
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Unknown error';
              this.logger.error(
                `Error processing individual message: ${message}`,
              );
              // Continue processing other messages
            }
          }
        }
      }

      return {
        status: 'ok',
        processedCount: results.length,
        results,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Webhook processing error: ${message}`);
      // Return 200 to prevent WhatsApp from retrying
      return { status: 'error', message };
    }
  }

  /**
   * Webhook verification endpoint (GET)
   * Required by WhatsApp for webhook setup
   *
   * GET /api/whatsapp/webhook?hub.verify_token=X&hub.challenge=Y
   */
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ): string | any {
    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'default_token';

    if (mode !== 'subscribe') {
      this.logger.warn(`Invalid mode for webhook verification: ${mode}`);
      return { status: 'error', message: 'Invalid mode' };
    }

    if (verifyToken !== expectedToken) {
      this.logger.warn(`Invalid verify token for webhook`);
      throw new BadRequestException('Invalid verify token');
    }

    this.logger.log('WhatsApp webhook verified successfully');
    return challenge; // Return the challenge as a string
  }

  /**
   * Health check endpoint
   * GET /api/whatsapp/health
   */
  @Get('health')
  getHealth(): any {
    return {
      status: 'ok',
      service: 'whatsapp',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Test endpoint to send message
   * POST /api/whatsapp/test-message
   * Body: { phone: string, text: string }
   */
  @Post('test-message')
  async testMessage(
    @Body() body: { phone: string; text: string },
  ): Promise<{ status: string; messageId: string; timestamp: Date; error?: string }> {
    if (!body.phone || !body.text) {
      throw new BadRequestException('Missing phone or text');
    }

    const normalizedPhone = body.phone.replace(/\D/g, '');
    if (!normalizedPhone || normalizedPhone.length < 10) {
      throw new BadRequestException('Phone must be a valid WhatsApp contact number');
    }

    if (normalizedPhone.length >= 12 && normalizedPhone.includes('@g.us')) {
      throw new BadRequestException('Group JID is not allowed for the isolated test message');
    }

    return this.baileysConnectionService.sendMessage({
      to: normalizedPhone,
      text: body.text,
    });
  }

  /**
   * Get conversation summary
   * GET /api/whatsapp/conversation/:conversationId
   */
  @Get('conversation/:conversationId')
  getConversation(@Param('conversationId') conversationId: string): any {
    if (!conversationId) {
      throw new BadRequestException('Missing conversationId');
    }

    return this.whatsAppService.getConversationSummary(conversationId);
  }
}
