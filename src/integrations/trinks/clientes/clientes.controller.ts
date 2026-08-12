import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { TrinksClientesResponse, TrinksCliente } from './clientes.types';

@Controller('trinks')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get('clientes')
  async getClientes(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('nome') nome?: string,
    @Query('cpf') cpf?: string,
    @Query('email') email?: string,
    @Query('telefone') telefone?: string,
    @Query('dataCadastroInicio') dataCadastroInicio?: string,
    @Query('dataCadastroFim') dataCadastroFim?: string,
    @Query('dataAlteracaoCadastralInicio') dataAlteracaoCadastralInicio?: string,
    @Query('dataAlteracaoCadastralFim') dataAlteracaoCadastralFim?: string,
    @Query('incluirDetalhes') incluirDetalhes?: string,
  ): Promise<TrinksClientesResponse<TrinksCliente>> {
    const pageValue = page ? Number(page) : undefined;
    const pageSizeValue = pageSize ? Number(pageSize) : undefined;

    return this.clientesService.getClientes({
      page: Number.isNaN(pageValue) ? undefined : pageValue,
      pageSize: Number.isNaN(pageSizeValue) ? undefined : pageSizeValue,
      nome,
      cpf,
      email,
      telefone,
      dataCadastroInicio,
      dataCadastroFim,
      dataAlteracaoCadastralInicio,
      dataAlteracaoCadastralFim,
      incluirDetalhes:
        incluirDetalhes === undefined ? undefined : incluirDetalhes === 'true',
    });
  }
}
