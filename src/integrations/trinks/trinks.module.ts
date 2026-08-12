import { Module } from '@nestjs/common';
import { AgendamentosController } from './agendamentos/agendamentos.controller';
import { AgendamentosService } from './agendamentos/agendamentos.service';
import { TrinksService } from './trinks.service';

@Module({
  controllers: [AgendamentosController],
  providers: [TrinksService, AgendamentosService],
})
export class TrinksModule {}
