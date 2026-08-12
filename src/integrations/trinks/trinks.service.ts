import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TrinksAgendamentosResponse,
  TrinksAgendamentosQuery,
  TrinksAgendaQuery,
  TrinksAgendaResponse,
  TrinksCreateAgendamentoPayload,
  TrinksCreateAgendamentoRequest,
  TrinksDisponibilidadeResponse,
} from './trinks.types';

@Injectable()
export class TrinksService {
  private readonly logger = new Logger(TrinksService.name);

  constructor(private readonly configService: ConfigService) {}

  private normalizeTrinksDate(value: string, isEndOfDay = false): string {
    const brazilianDateMatch = /^\d{2}\/\d{2}\/\d{4}$/.test(value);
    if (!brazilianDateMatch) {
      return value;
    }

    const [day, month, year] = value.split('/');
    const formatted = `${year}-${month}-${day}`;
    return isEndOfDay ? `${formatted}T23:59:59` : `${formatted}T00:00:00`;
  }

  private normalizeTrinksDatePath(value: string): string {
    const brazilianDateMatch = /^\d{2}\/\d{2}\/\d{4}$/.test(value);
    if (!brazilianDateMatch) {
      return value;
    }

    const [day, month, year] = value.split('/');
    return `${year}-${month}-${day}`;
  }

  async getAgendamentos(query: TrinksAgendamentosQuery): Promise<TrinksAgendamentosResponse> {
    const apiKey = this.configService.get<string>('TRINKS_API_KEY');
    const baseUrl = this.configService.get<string>('TRINKS_BASE_URL');
    const estabelecimentoId = this.configService.get<string>(
      'TRINKS_ESTABELECIMENTO_ID',
    );

    if (!apiKey || !baseUrl || !estabelecimentoId) {
      throw new HttpException(
        'Trinks API configuration is missing. Check TRINKS_API_KEY, TRINKS_BASE_URL and TRINKS_ESTABELECIMENTO_ID.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const base = new URL(baseUrl);
    const normalizedBasePath = base.pathname.replace(/\/$/, '');
    const requestPath = normalizedBasePath.endsWith('/v1')
      ? `${normalizedBasePath}/agendamentos`
      : `${normalizedBasePath}/v1/agendamentos`;

    const url = new URL(requestPath, base.origin);

    if (query.page !== undefined) {
      url.searchParams.set('page', String(query.page));
    }
    if (query.pageSize !== undefined) {
      url.searchParams.set('pageSize', String(query.pageSize));
    }
    if (query.clienteId !== undefined) {
      url.searchParams.set('clienteId', String(query.clienteId));
    }
    if (query.dataInicio !== undefined) {
      url.searchParams.set(
        'dataInicio',
        this.normalizeTrinksDate(query.dataInicio),
      );
    }
    if (query.dataFim !== undefined) {
      url.searchParams.set(
        'dataFim',
        this.normalizeTrinksDate(query.dataFim, true),
      );
    }

    const headers = {
      'X-Api-Key': apiKey,
      estabelecimentoId,
      Accept: 'application/json',
    };

    let response: Response;

    try {
      response = await (globalThis as any).fetch(url.toString(), {
        method: 'GET',
        headers,
      });
    } catch (error) {
      this.logger.error(
        'Failed to communicate with Trinks API',
        error as Error,
      );
      throw new HttpException(
        'Failed to communicate with Trinks API',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const responseText = await response.text();
    let payload: unknown;

    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
      this.logger.error(
        'Invalid JSON received from Trinks API',
        error as Error,
      );
      throw new HttpException(
        'Invalid response from Trinks API',
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (response.ok) {
      return payload as TrinksAgendamentosResponse;
    }

    switch (response.status) {
      case HttpStatus.UNAUTHORIZED:
      case HttpStatus.FORBIDDEN:
        throw new HttpException(
          'Trinks API authentication or authorization failed',
          HttpStatus.BAD_GATEWAY,
        );
      case HttpStatus.BAD_REQUEST:
        throw new HttpException(
          payload || 'Bad request to Trinks API',
          HttpStatus.BAD_REQUEST,
        );
      case HttpStatus.NOT_FOUND:
        throw new HttpException(
          'Trinks endpoint not found',
          HttpStatus.NOT_FOUND,
        );
      case HttpStatus.TOO_MANY_REQUESTS:
        this.logger.warn(
          'Trinks rate limit reached (HTTP 429). No retry will be performed.',
        );
        throw new HttpException(
          'Trinks rate limit reached',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      default:
        this.logger.error(
          `Trinks API returned unexpected status ${response.status}`,
          payload as Error,
        );
        throw new HttpException(
          'Trinks API returned an unexpected error',
          HttpStatus.BAD_GATEWAY,
        );
    }
  }

  prepareCreateAgendamentoRequest(
    payload: TrinksCreateAgendamentoPayload,
  ): TrinksCreateAgendamentoRequest {
    const apiKey = this.configService.get<string>('TRINKS_API_KEY');
    const baseUrl = this.configService.get<string>('TRINKS_BASE_URL');
    const estabelecimentoId = this.configService.get<string>(
      'TRINKS_ESTABELECIMENTO_ID',
    );

    if (!apiKey || !baseUrl || !estabelecimentoId) {
      throw new HttpException(
        'Trinks API configuration is missing. Check TRINKS_API_KEY, TRINKS_BASE_URL and TRINKS_ESTABELECIMENTO_ID.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const base = new URL(baseUrl);
    const normalizedBasePath = base.pathname.replace(/\/$/, '');
    const requestPath = normalizedBasePath.endsWith('/v1')
      ? `${normalizedBasePath}/agendamentos`
      : `${normalizedBasePath}/v1/agendamentos`;

    const url = new URL(requestPath, base.origin).toString();

    const body: TrinksCreateAgendamentoPayload = {
      servicoId: payload.servicoId,
      clienteId: payload.clienteId,
      profissionalId:
        payload.profissionalId !== undefined
          ? payload.profissionalId
          : null,
      dataHoraInicio: payload.dataHoraInicio,
      duracaoEmMinutos: payload.duracaoEmMinutos,
      valor: payload.valor,
      observacoes:
        payload.observacoes !== undefined ? payload.observacoes : null,
      confirmado: payload.confirmado ?? false,
    };

    return {
      method: 'POST',
      url,
      headers: {
        'X-Api-Key': apiKey,
        estabelecimentoId,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body,
    };
  }

  async getAgenda(query: TrinksAgendaQuery): Promise<TrinksAgendaResponse> {
    const apiKey = this.configService.get<string>('TRINKS_API_KEY');
    const baseUrl = this.configService.get<string>('TRINKS_BASE_URL');
    const estabelecimentoId = this.configService.get<string>(
      'TRINKS_ESTABELECIMENTO_ID',
    );

    if (!apiKey || !baseUrl || !estabelecimentoId) {
      throw new HttpException(
        'Trinks API configuration is missing. Check TRINKS_API_KEY, TRINKS_BASE_URL and TRINKS_ESTABELECIMENTO_ID.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const base = new URL(baseUrl);
    const normalizedBasePath = base.pathname.replace(/\/$/, '');
    const dateSegment = query.data ? `/${this.normalizeTrinksDatePath(query.data)}` : '';
    const requestPath = normalizedBasePath.endsWith('/v1')
      ? `${normalizedBasePath}/agendamentos/profissionais${dateSegment}`
      : `${normalizedBasePath}/v1/agendamentos/profissionais${dateSegment}`;

    const url = new URL(requestPath, base.origin);

    if (query.servicoId !== undefined) {
      url.searchParams.set('servicoId', String(query.servicoId));
    }
    if (query.servicoDuracao !== undefined) {
      url.searchParams.set('servicoDuracao', String(query.servicoDuracao));
    }
    if (query.profissionalId !== undefined) {
      url.searchParams.set('profissionalId', String(query.profissionalId));
    }
    if (query.intervalos !== undefined) {
      url.searchParams.set('intervalos', String(query.intervalos));
    }
    if (query.page !== undefined) {
      url.searchParams.set('page', String(query.page));
    }
    if (query.excluirExcecoesDeAgendamentoOnline !== undefined) {
      url.searchParams.set(
        'excluirExcecoesDeAgendamentoOnline',
        String(query.excluirExcecoesDeAgendamentoOnline),
      );
    }

    const headers = {
      'X-Api-Key': apiKey,
      estabelecimentoId,
      Accept: 'application/json',
    };

    let response: Response;

    try {
      response = await (globalThis as any).fetch(url.toString(), {
        method: 'GET',
        headers,
      });
    } catch (error) {
      this.logger.error(
        'Failed to communicate with Trinks API',
        error as Error,
      );
      throw new HttpException(
        'Failed to communicate with Trinks API',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const responseText = await response.text();
    let payload: unknown;

    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
      this.logger.error(
        'Invalid JSON received from Trinks API',
        error as Error,
      );
      throw new HttpException(
        'Invalid response from Trinks API',
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (response.ok) {
      return payload as TrinksAgendaResponse;
    }

    switch (response.status) {
      case HttpStatus.UNAUTHORIZED:
      case HttpStatus.FORBIDDEN:
        throw new HttpException(
          'Trinks API authentication or authorization failed',
          HttpStatus.BAD_GATEWAY,
        );
      case HttpStatus.BAD_REQUEST:
        throw new HttpException(
          payload || 'Bad request to Trinks API',
          HttpStatus.BAD_REQUEST,
        );
      case HttpStatus.NOT_FOUND:
        throw new HttpException(
          'Trinks endpoint not found',
          HttpStatus.NOT_FOUND,
        );
      case HttpStatus.TOO_MANY_REQUESTS:
        this.logger.warn(
          'Trinks rate limit reached (HTTP 429). No retry will be performed.',
        );
        throw new HttpException(
          'Trinks rate limit reached',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      default:
        this.logger.error(
          `Trinks API returned unexpected status ${response.status}`,
          payload as Error,
        );
        throw new HttpException(
          'Trinks API returned an unexpected error',
          HttpStatus.BAD_GATEWAY,
        );
    }
  }

  async getDisponibilidade(
    query: TrinksAgendaQuery,
  ): Promise<TrinksDisponibilidadeResponse> {
    const agenda = (await this.getAgenda(query)) as TrinksAgendaResponse;

    return {
      page: agenda.page,
      pageSize: agenda.pageSize,
      totalPages: agenda.totalPages,
      totalRecords: agenda.totalRecords,
      data: Array.isArray(agenda.data)
        ? agenda.data.map((item) => ({
            ...item,
            horariosVagos: Array.isArray(item.horariosVagos)
              ? item.horariosVagos
              : [],
            intervalosVagos: Array.isArray(item.intervalosVagos)
              ? item.intervalosVagos
              : [],
          }))
        : [],
    };
  }
}
