import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Query,
  Param,
} from '@nestjs/common';
import { AgendamentosService } from './agendamentos.service';
import {
  TrinksAgendamentosResponse,
  TrinksAgendaResponse,
  TrinksCreateAgendamentoPayload,
  TrinksCreateAgendamentoRequest,
  TrinksDisponibilidadeResponse,
  EditarAgendamentoModel,
  CancelamentoAgendamentoModel,
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
    if (!data) {
      throw new BadRequestException(
        'A query param data é obrigatória para agenda e profissionais agendados.',
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

  @Post('agendamentos')
  async createAgendamento(
    @Body() payload: TrinksCreateAgendamentoPayload,
  ): Promise<unknown> {
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

    const preparedRequest =
      await this.agendamentosService.prepareCreateAgendamentoRequest(payload);

    return this.agendamentosService.createAgendamento(preparedRequest);
  }

  @Put('agendamentos/:id')
  async editAgendamento(
    @Param('id') id?: string,
    @Body() payload?: EditarAgendamentoModel,
  ): Promise<void> {
    const idValue = id ? Number(id) : undefined;

    if (idValue === undefined || Number.isNaN(idValue)) {
      throw new BadRequestException('id é obrigatório e deve ser number.');
    }

    if (!payload) {
      throw new BadRequestException('payload é obrigatório.');
    }

    if (typeof payload.servicoId !== 'number') {
      throw new BadRequestException(
        'servicoId é obrigatório e deve ser number.',
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

    return this.agendamentosService.updateAgendamento(idValue, payload);
  }

  @Patch('agendamentos/:agendamentoId/status/cancelado')
  async cancelarAgendamento(
    @Param('agendamentoId') agendamentoId?: string,
    @Body() payload?: CancelamentoAgendamentoModel,
  ): Promise<void> {
    const idValue = agendamentoId ? Number(agendamentoId) : undefined;

    if (idValue === undefined || Number.isNaN(idValue)) {
      throw new BadRequestException(
        'agendamentoId é obrigatório e deve ser number.',
      );
    }

    return this.agendamentosService.cancelarAgendamento(idValue, payload ?? {});
  }

  @Post('agendamentos/prepare')
  async prepareCreateAgendamento(
    @Body() payload: TrinksCreateAgendamentoPayload,
  ): Promise<TrinksCreateAgendamentoRequest> {
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
