import { Module } from '@nestjs/common';
import { AgendamentosController } from './agendamentos/agendamentos.controller';
import { AgendamentosService } from './agendamentos/agendamentos.service';
import { AssinaturasController } from './assinaturas/assinaturas.controller';
import { AssinaturasService } from './assinaturas/assinaturas.service';
import { ClientesController } from './clientes/clientes.controller';
import { ClientesService } from './clientes/clientes.service';
import { PlanosController } from './planos/planos.controller';
import { PlanosService } from './planos/planos.service';
import { ProfissionaisController } from './profissionais/profissionais.controller';
import { ProfissionaisService } from './profissionais/profissionais.service';
import { ServicosController } from './servicos/servicos.controller';
import { ServicosService } from './servicos/servicos.service';
import { TrinksService } from './trinks.service';

@Module({
  controllers: [
    AgendamentosController,
    AssinaturasController,
    ClientesController,
    PlanosController,
    ProfissionaisController,
    ServicosController,
  ],
  providers: [
    TrinksService,
    AgendamentosService,
    AssinaturasService,
    ClientesService,
    PlanosService,
    ProfissionaisService,
    ServicosService,
  ],
  exports: [
    TrinksService,
    AgendamentosService,
    AssinaturasService,
    ClientesService,
    PlanosService,
    ProfissionaisService,
    ServicosService,
  ],
})
export class TrinksModule {}
