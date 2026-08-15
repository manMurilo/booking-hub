import {
  Controller,
  Get,
  Query,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { ProfissionaisService } from './profissionais.service';
import {
  TrinksProfissionaisResponse,
  TrinksProfissional,
} from './profissionais.types';

@Controller('trinks')
export class ProfissionaisController {
  constructor(private readonly profissionaisService: ProfissionaisService) {}

  @Get('profissionais')
  async getProfissionais(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('nome') nome?: string,
  ): Promise<TrinksProfissionaisResponse<TrinksProfissional>> {
    const pageValue = page ? Number(page) : undefined;
    const pageSizeValue = pageSize ? Number(pageSize) : undefined;

    return this.profissionaisService.getProfissionais({
      page: Number.isNaN(pageValue) ? undefined : pageValue,
      pageSize: Number.isNaN(pageSizeValue) ? undefined : pageSizeValue,
      nome,
    });
  }

  @Get('profissionais/:profissionalId/servicos')
  async getServicosDoProfissional(
    @Param('profissionalId') profissionalId?: string,
  ) {
    const profissionalIdValue = profissionalId
      ? Number(profissionalId)
      : undefined;

    if (
      profissionalIdValue === undefined ||
      Number.isNaN(profissionalIdValue)
    ) {
      throw new BadRequestException(
        'profissionalId é obrigatório e deve ser number.',
      );
    }

    return this.profissionaisService.getServicosDoProfissional(
      profissionalIdValue,
    );
  }

  @Get('profissionais/categoria/:servicoCategoriaEstabelecimentoId')
  async getProfissionaisPorCategoria(
    @Param('servicoCategoriaEstabelecimentoId')
    servicoCategoriaEstabelecimentoId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<TrinksProfissionaisResponse<TrinksProfissional>> {
    const pageValue = page ? Number(page) : undefined;
    const pageSizeValue = pageSize ? Number(pageSize) : undefined;
    const servicoCategoriaValue = servicoCategoriaEstabelecimentoId
      ? Number(servicoCategoriaEstabelecimentoId)
      : undefined;

    if (
      servicoCategoriaValue === undefined ||
      Number.isNaN(servicoCategoriaValue)
    ) {
      throw new BadRequestException(
        'servicoCategoriaEstabelecimentoId é obrigatório e deve ser number.',
      );
    }

    return this.profissionaisService.getProfissionaisPorCategoria(
      servicoCategoriaValue,
      {
        page: Number.isNaN(pageValue) ? undefined : pageValue,
        pageSize: Number.isNaN(pageSizeValue) ? undefined : pageSizeValue,
      },
    );
  }
}
