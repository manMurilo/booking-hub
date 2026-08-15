import { Module } from '@nestjs/common';
import { DeterministicMessageInterpreter } from './message-interpreter.service';

@Module({
  providers: [DeterministicMessageInterpreter],
  exports: [DeterministicMessageInterpreter],
})
export class MessageInterpreterModule {}
