import { Controller, Get, Query } from '@nestjs/common';
import { PlanosService } from './planos.service';
import { PlanosResponse, PlanoClienteDTO, PlanosQuery } from './planos.types';

@Controller('trinks')
export class PlanosController {
  constructor(private readonly planosService: PlanosService) {}

  @Get('planos')
  async getPlanos(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('somenteAtivos') somenteAtivos?: string,
    @Query('ordenarPor')
    ordenarPor?: 'AssinaturasMaisRecente' | 'Nome' | 'Status',
    @Query('nome') nome?: string,
  ): Promise<PlanosResponse<PlanoClienteDTO>> {
    const pageValue = page ? Number(page) : undefined;
    const pageSizeValue = pageSize ? Number(pageSize) : undefined;

    return this.planosService.getPlanos({
      page: Number.isNaN(pageValue) ? undefined : pageValue,
      pageSize: Number.isNaN(pageSizeValue) ? undefined : pageSizeValue,
      somenteAtivos:
        somenteAtivos === undefined ? undefined : somenteAtivos === 'true',
      ordenarPor,
      nome,
    });
  }
}
