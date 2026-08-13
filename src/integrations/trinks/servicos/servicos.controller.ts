import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ServicosService } from './servicos.service';
import {
  TrinksServicosQuery,
  TrinksServicosResponse,
  TrinksServico,
} from './servicos.types';

@Controller('trinks')
export class ServicosController {
  constructor(private readonly servicosService: ServicosService) {}

  @Get('servicos')
  async getServicos(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('nome') nome?: string,
    @Query('id') id?: string,
    @Query('ativo') ativo?: string,
  ): Promise<TrinksServicosResponse<TrinksServico>> {
    const pageValue = page ? Number(page) : undefined;
    const pageSizeValue = pageSize ? Number(pageSize) : undefined;

    return this.servicosService.getServicos({
      page: Number.isNaN(pageValue) ? undefined : pageValue,
      pageSize: Number.isNaN(pageSizeValue) ? undefined : pageSizeValue,
      nome,
      id: id ? Number(id) : undefined,
      ativo: ativo === undefined ? undefined : ativo === 'true',
    });
  }
}
