import { Module } from '@nestjs/common';
import { AIModule } from '../../ai/ai.module';
import { DeterministicMessageInterpreter } from './message-interpreter.service';
import { MessageContextUpdaterService } from './message-context-updater.service';

@Module({
  imports: [AIModule],
  providers: [DeterministicMessageInterpreter, MessageContextUpdaterService],
  exports: [DeterministicMessageInterpreter, MessageContextUpdaterService],
})
export class MessageInterpreterModule {}
