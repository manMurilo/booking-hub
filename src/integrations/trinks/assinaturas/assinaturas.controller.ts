import { Controller, Get, Query } from '@nestjs/common';
import { AssinaturasService } from './assinaturas.service';
import {
  AssinaturasResponse,
  AssinaturaDTO,
  AssinaturasQuery,
} from './assinaturas.types';

@Controller('trinks')
export class AssinaturasController {
  constructor(private readonly assinaturasService: AssinaturasService) {}

  @Get('assinaturas')
  async getAssinaturas(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('clienteCpf') clienteCpf?: string,
    @Query('clienteNome') clienteNome?: string,
    @Query('planoId') planoId?: string,
    @Query('status')
    status?:
      | 'Ativa'
      | 'Atrasada'
      | 'SuspensaPorFaltaDePagamento'
      | 'Cancelada'
      | 'Encerrada'
      | 'AguardandoPagamento'
      | 'CanceladaEmPeriodoDeConsumo',
    @Query('ordenarPor')
    ordenarPor?:
      | 'AssinaturaMaisRecente'
      | 'ClienteNome'
      | 'AssinaturaNome'
      | 'Status'
      | 'ProximoPagamento'
      | 'CobrancaEncerraApos',
  ): Promise<AssinaturasResponse<AssinaturaDTO>> {
    const pageValue = page ? Number(page) : undefined;
    const pageSizeValue = pageSize ? Number(pageSize) : undefined;
    const planoIdValue = planoId ? Number(planoId) : undefined;

    const query: AssinaturasQuery = {
      page: Number.isNaN(pageValue) ? undefined : pageValue,
      pageSize: Number.isNaN(pageSizeValue) ? undefined : pageSizeValue,
      clienteCpf,
      clienteNome,
      planoId: Number.isNaN(planoIdValue) ? undefined : planoIdValue,
      status,
      ordenarPor,
    };

    return this.assinaturasService.getAssinaturas(query);
  }
}
