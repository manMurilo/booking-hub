import { Module } from '@nestjs/common';
import { AgendamentosController } from './agendamentos/agendamentos.controller';
import { AgendamentosService } from './agendamentos/agendamentos.service';
import { ClientesController } from './clientes/clientes.controller';
import { ClientesService } from './clientes/clientes.service';
import { ProfissionaisController } from './profissionais/profissionais.controller';
import { ProfissionaisService } from './profissionais/profissionais.service';
import { ServicosController } from './servicos/servicos.controller';
import { ServicosService } from './servicos/servicos.service';
import { TrinksService } from './trinks.service';

@Module({
  controllers: [
    AgendamentosController,
    ClientesController,
    ProfissionaisController,
    ServicosController,
  ],
  providers: [
    TrinksService,
    AgendamentosService,
    ClientesService,
    ProfissionaisService,
    ServicosService,
  ],
})
export class TrinksModule {}
