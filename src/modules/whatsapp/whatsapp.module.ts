import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { AIModule } from '../../ai/ai.module';
import { BookingModule } from '../booking/booking.module';
import { ConversationStateModule } from '../conversation-state/conversation-state.module';

/**
 * WhatsApp Module
 * Orchestrates AI, Booking, and Conversation State
 * Handles incoming WhatsApp messages and generates responses
 */
@Module({
  imports: [AIModule, BookingModule, ConversationStateModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
