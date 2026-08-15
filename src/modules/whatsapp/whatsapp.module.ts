import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { AIModule } from '../../ai/ai.module';
import { BookingModule } from '../booking/booking.module';
import { ConversationStateModule } from '../conversation-state/conversation-state.module';
import { BaileysConnectionService } from '../../integrations/whatsapp/baileys-connection.service';
import { WhatsAppMessageAdapterService } from '../../integrations/whatsapp/whatsapp-message-adapter.service';

/**
 * WhatsApp Module
 * Orchestrates AI, Booking, Conversation State, and Baileys integration
 * Handles incoming WhatsApp messages and generates responses
 */
@Module({
  imports: [AIModule, BookingModule, ConversationStateModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, BaileysConnectionService, WhatsAppMessageAdapterService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
