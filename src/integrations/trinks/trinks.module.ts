import { Module } from '@nestjs/common';
import { AgendamentosController } from './agendamentos/agendamentos.controller';
import { AgendamentosService } from './agendamentos/agendamentos.service';
import { ClientesController } from './clientes/clientes.controller';
import { ClientesService } from './clientes/clientes.service';
import { TrinksService } from './trinks.service';

@Module({
  controllers: [AgendamentosController, ClientesController],
  providers: [TrinksService, AgendamentosService, ClientesService],
})
export class TrinksModule {}
