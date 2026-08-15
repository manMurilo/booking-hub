import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIService } from './ai.service';

/**
 * AI Module - Handles LLM integration and message processing
 */
@Module({
  imports: [ConfigModule],
  providers: [AIService],
  exports: [AIService],
})
export class AIModule {}
