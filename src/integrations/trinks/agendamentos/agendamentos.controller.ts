import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { AgendamentosService } from './agendamentos.service';
import {
  TrinksAgendamentosResponse,
  TrinksAgendaResponse,
  TrinksCreateAgendamentoPayload,
  TrinksCreateAgendamentoRequest,
  TrinksDisponibilidadeResponse,
} from './agendamentos.types';

@Controller('trinks')
export class AgendamentosController {
  constructor(private readonly agendamentosService: AgendamentosService) {}

  @Get('agendamentos')
  async getAgendamentos(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('clienteId') clienteId?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ): Promise<TrinksAgendamentosResponse> {
    const pageValue = page ? Number(page) : undefined;
    const pageSizeValue = pageSize ? Number(pageSize) : undefined;
    const clienteIdValue = clienteId ? Number(clienteId) : undefined;

    return this.agendamentosService.getAgendamentos({
      page: Number.isNaN(pageValue) ? undefined : pageValue,
      pageSize: Number.isNaN(pageSizeValue) ? undefined : pageSizeValue,
      clienteId: Number.isNaN(clienteIdValue) ? undefined : clienteIdValue,
      dataInicio,
      dataFim,
    });
  }

  @Get(['agenda', 'agendamentos/profissionais'])
  async getAgenda(
    @Query('data') data?: string,
    @Query('servicoId') servicoId?: string,
    @Query('servicoDuracao') servicoDuracao?: string,
    @Query('profissionalId') profissionalId?: string,
    @Query('intervalos') intervalos?: string,
    @Query('page') page?: string,
    @Query('excluirExcecoesDeAgendamentoOnline')
    excluirExcecoesDeAgendamentoOnline?: string,
  ): Promise<TrinksAgendaResponse> {
    const servicoIdValue = servicoId ? Number(servicoId) : undefined;
    const servicoDuracaoValue = servicoDuracao
      ? Number(servicoDuracao)
      : undefined;
    const profissionalIdValue = profissionalId
      ? Number(profissionalId)
      : undefined;
    const intervalosValue = intervalos ? Number(intervalos) : undefined;
    const pageValue = page ? Number(page) : undefined;

    return this.agendamentosService.getAgenda({
      data,
      servicoId: Number.isNaN(servicoIdValue) ? undefined : servicoIdValue,
      servicoDuracao: Number.isNaN(servicoDuracaoValue)
        ? undefined
        : servicoDuracaoValue,
      profissionalId: Number.isNaN(profissionalIdValue)
        ? undefined
        : profissionalIdValue,
      intervalos: Number.isNaN(intervalosValue) ? undefined : intervalosValue,
      page: Number.isNaN(pageValue) ? undefined : pageValue,
      excluirExcecoesDeAgendamentoOnline:
        excluirExcecoesDeAgendamentoOnline === undefined
          ? undefined
          : excluirExcecoesDeAgendamentoOnline === 'true',
    });
  }

  @Get('disponibilidade')
  async getDisponibilidade(
    @Query('data') data?: string,
    @Query('servicoId') servicoId?: string,
    @Query('servicoDuracao') servicoDuracao?: string,
    @Query('profissionalId') profissionalId?: string,
    @Query('intervalos') intervalos?: string,
    @Query('page') page?: string,
    @Query('excluirExcecoesDeAgendamentoOnline')
    excluirExcecoesDeAgendamentoOnline?: string,
  ): Promise<TrinksDisponibilidadeResponse> {
    if (!data) {
      throw new BadRequestException(
        'A query param data é obrigatória para disponibilidade.',
      );
    }

    const servicoIdValue = servicoId ? Number(servicoId) : undefined;
    const servicoDuracaoValue = servicoDuracao
      ? Number(servicoDuracao)
      : undefined;
    const profissionalIdValue = profissionalId
      ? Number(profissionalId)
      : undefined;
    const intervalosValue = intervalos ? Number(intervalos) : undefined;
    const pageValue = page ? Number(page) : undefined;

    return this.agendamentosService.getDisponibilidade({
      data,
      servicoId: Number.isNaN(servicoIdValue) ? undefined : servicoIdValue,
      servicoDuracao: Number.isNaN(servicoDuracaoValue)
        ? undefined
        : servicoDuracaoValue,
      profissionalId: Number.isNaN(profissionalIdValue)
        ? undefined
        : profissionalIdValue,
      intervalos: Number.isNaN(intervalosValue) ? undefined : intervalosValue,
      page: Number.isNaN(pageValue) ? undefined : pageValue,
      excluirExcecoesDeAgendamentoOnline:
        excluirExcecoesDeAgendamentoOnline === undefined
          ? undefined
          : excluirExcecoesDeAgendamentoOnline === 'true',
    });
  }

  @Post('agendamentos/prepare')
  prepareCreateAgendamento(
    @Body() payload: TrinksCreateAgendamentoPayload,
  ): TrinksCreateAgendamentoRequest {
    if (typeof payload.servicoId !== 'number') {
      throw new BadRequestException(
        'servicoId is obrigatório e deve ser number.',
      );
    }
    if (typeof payload.clienteId !== 'number') {
      throw new BadRequestException(
        'clienteId é obrigatório e deve ser number.',
      );
    }
    if (typeof payload.dataHoraInicio !== 'string') {
      throw new BadRequestException(
        'dataHoraInicio é obrigatório e deve ser string.',
      );
    }
    if (typeof payload.duracaoEmMinutos !== 'number') {
      throw new BadRequestException(
        'duracaoEmMinutos é obrigatório e deve ser number.',
      );
    }
    if (typeof payload.valor !== 'number') {
      throw new BadRequestException('valor é obrigatório e deve ser number.');
    }
    if (
      payload.profissionalId !== undefined &&
      payload.profissionalId !== null &&
      typeof payload.profissionalId !== 'number'
    ) {
      throw new BadRequestException('profissionalId deve ser number ou null.');
    }
    if (
      payload.observacoes !== undefined &&
      payload.observacoes !== null &&
      typeof payload.observacoes !== 'string'
    ) {
      throw new BadRequestException('observacoes deve ser string ou null.');
    }
    if (
      payload.confirmado !== undefined &&
      typeof payload.confirmado !== 'boolean'
    ) {
      throw new BadRequestException('confirmado deve ser boolean.');
    }

    return this.agendamentosService.prepareCreateAgendamentoRequest(payload);
  }
}
