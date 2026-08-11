import { Module } from '@nestjs/common';
import { TrinksController } from './trinks.controller';
import { TrinksService } from './trinks.service';

@Module({
  controllers: [TrinksController],
  providers: [TrinksService],
})
export class TrinksModule {}
