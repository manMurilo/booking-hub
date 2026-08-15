import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TrinksService } from '../trinks.service';
import { ClientesService } from '../clientes/clientes.service';
import { ProfissionaisService } from '../profissionais/profissionais.service';
import { ServicosService } from '../servicos/servicos.service';
import {
  TrinksAgendamentosResponse,
  TrinksAgendamentosQuery,
  TrinksAgendaQuery,
  TrinksAgendaResponse,
  TrinksCreateAgendamentoPayload,
  TrinksCreateAgendamentoRequest,
  TrinksDisponibilidadeResponse,
} from './agendamentos.types';
import { EditarAgendamentoModel } from './agendamentos.types';
import { CancelamentoAgendamentoModel } from './agendamentos.types';

@Injectable()
export class AgendamentosService {
  private readonly logger = new Logger(AgendamentosService.name);

  constructor(
    private readonly trinksService: TrinksService,
    private readonly clientesService: ClientesService,
    private readonly profissionaisService: ProfissionaisService,
    private readonly servicosService: ServicosService,
  ) {}

  async getAgendamentos(
    query: TrinksAgendamentosQuery,
  ): Promise<TrinksAgendamentosResponse> {
    const { apiKey, baseUrl, estabelecimentoId } =
      this.trinksService.getApiConfig();
    const url = this.trinksService.buildApiUrl('/agendamentos', baseUrl);

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
        this.trinksService.normalizeTrinksDate(query.dataInicio),
      );
    }
    if (query.dataFim !== undefined) {
      url.searchParams.set(
        'dataFim',
        this.trinksService.normalizeTrinksDate(query.dataFim, true),
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

  async updateAgendamento(
    agendamentoId: number,
    payload: EditarAgendamentoModel,
  ): Promise<void> {
    const { apiKey, baseUrl, estabelecimentoId } =
      this.trinksService.getApiConfig();
    const url = this.trinksService.buildApiUrl(
      `/agendamentos/${agendamentoId}`,
      baseUrl,
    );

    const headers = {
      'X-Api-Key': apiKey,
      estabelecimentoId,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    let response: Response;

    try {
      response = await (globalThis as any).fetch(url.toString(), {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      });
    } catch (error) {
      this.logger.error(
        'Failed to communicate with Trinks API while updating an appointment',
        error as Error,
      );
      throw new HttpException(
        'Failed to communicate with Trinks API',
        HttpStatus.BAD_GATEWAY,
      );
    }

    // Expecting 204 No Content on success
    if (response.status === HttpStatus.NO_CONTENT) {
      return;
    }

    const responseText = await response.text();
    let parsed: unknown;

    try {
      parsed = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
      this.logger.error(
        'Invalid JSON received from Trinks API while updating an appointment',
        error as Error,
      );
      throw new HttpException(
        'Invalid response from Trinks API',
        HttpStatus.BAD_GATEWAY,
      );
    }

    switch (response.status) {
      case HttpStatus.UNAUTHORIZED:
      case HttpStatus.FORBIDDEN:
        throw new HttpException(
          'Trinks API authentication or authorization failed',
          HttpStatus.BAD_GATEWAY,
        );
      case HttpStatus.BAD_REQUEST:
      case 422:
        throw new HttpException(
          parsed || 'Bad request to Trinks API',
          HttpStatus.BAD_REQUEST,
        );
      case HttpStatus.NOT_FOUND:
        throw new HttpException(
          'Trinks resource not found',
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
          parsed as Error,
        );
        throw new HttpException(
          'Trinks API returned an unexpected error',
          HttpStatus.BAD_GATEWAY,
        );
    }
  }

  async cancelarAgendamento(
    agendamentoId: number,
    payload: CancelamentoAgendamentoModel,
  ): Promise<void> {
    const { apiKey, baseUrl, estabelecimentoId } =
      this.trinksService.getApiConfig();
    const url = this.trinksService.buildApiUrl(
      `/agendamentos/${agendamentoId}/status/cancelado`,
      baseUrl,
    );

    const headers = {
      'X-Api-Key': apiKey,
      estabelecimentoId,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    let response: Response;

    try {
      response = await (globalThis as any).fetch(url.toString(), {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
    } catch (error) {
      this.logger.error(
        'Failed to communicate with Trinks API while cancelling an appointment',
        error as Error,
      );
      throw new HttpException(
        'Failed to communicate with Trinks API',
        HttpStatus.BAD_GATEWAY,
      );
    }

    // Expecting 204 No Content on success
    if (response.status === HttpStatus.NO_CONTENT) {
      return;
    }

    const responseText = await response.text();
    let parsed: unknown;

    try {
      parsed = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
      this.logger.error(
        'Invalid JSON received from Trinks API while cancelling an appointment',
        error as Error,
      );
      throw new HttpException(
        'Invalid response from Trinks API',
        HttpStatus.BAD_GATEWAY,
      );
    }

    switch (response.status) {
      case HttpStatus.UNAUTHORIZED:
      case HttpStatus.FORBIDDEN:
        throw new HttpException(
          'Trinks API authentication or authorization failed',
          HttpStatus.BAD_GATEWAY,
        );
      case HttpStatus.BAD_REQUEST:
      case 422:
        throw new HttpException(
          parsed || 'Bad request to Trinks API',
          HttpStatus.BAD_REQUEST,
        );
      case HttpStatus.NOT_FOUND:
        throw new HttpException(
          'Trinks resource not found',
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
          parsed as Error,
        );
        throw new HttpException(
          'Trinks API returned an unexpected error',
          HttpStatus.BAD_GATEWAY,
        );
    }
  }

  async validateLocalAgendamentoRules(
    payload: TrinksCreateAgendamentoPayload,
  ): Promise<TrinksCreateAgendamentoPayload> {
    if (
      !payload ||
      typeof payload.servicoId !== 'number' ||
      payload.servicoId <= 0
    ) {
      throw new BadRequestException(
        'servicoId é obrigatório e deve ser maior que zero.',
      );
    }

    if (
      !payload ||
      typeof payload.clienteId !== 'number' ||
      payload.clienteId <= 0
    ) {
      throw new BadRequestException(
        'clienteId é obrigatório e deve ser maior que zero.',
      );
    }

    if (
      !payload ||
      typeof payload.dataHoraInicio !== 'string' ||
      !payload.dataHoraInicio
    ) {
      throw new BadRequestException(
        'dataHoraInicio é obrigatório e deve ser string.',
      );
    }

    const dataHoraInicio = new Date(payload.dataHoraInicio);
    if (Number.isNaN(dataHoraInicio.getTime())) {
      throw new BadRequestException('dataHoraInicio inválida.');
    }

    if (
      typeof payload.duracaoEmMinutos !== 'number' ||
      Number.isNaN(payload.duracaoEmMinutos) ||
      payload.duracaoEmMinutos <= 0
    ) {
      throw new BadRequestException(
        'duracaoEmMinutos deve ser maior que zero.',
      );
    }

    try {
      await this.clientesService.getClientePorId(payload.clienteId);
    } catch (error) {
      throw new UnprocessableEntityException(
        'Cliente não encontrado na Trinks.',
      );
    }

    const servicos = await this.servicosService.getServicos({});
    const servico = servicos?.data?.find(
      (item: any) => item.id === payload.servicoId,
    );
    if (!servico) {
      throw new UnprocessableEntityException(
        'Serviço não encontrado na Trinks.',
      );
    }

    if (
      payload.profissionalId === undefined ||
      payload.profissionalId === null ||
      Number.isNaN(Number(payload.profissionalId))
    ) {
      throw new UnprocessableEntityException(
        'Profissional é obrigatório para o agendamento.',
      );
    }

    const profissionais = await this.profissionaisService.getProfissionais({});
    const profissional = profissionais?.data?.find(
      (item: any) => item.id === payload.profissionalId,
    );
    if (!profissional) {
      throw new UnprocessableEntityException(
        'Profissional não encontrado na Trinks.',
      );
    }

    const data = `${dataHoraInicio.getFullYear()}-${String(
      dataHoraInicio.getMonth() + 1,
    ).padStart(2, '0')}-${String(dataHoraInicio.getDate()).padStart(2, '0')}`;
    const horario = `${String(dataHoraInicio.getHours()).padStart(2, '0')}:${String(
      dataHoraInicio.getMinutes(),
    ).padStart(2, '0')}`;

    const agenda = await this.getAgenda({
      profissionalId: Number(payload.profissionalId),
      data,
    });

    const horarioDisponivel = agenda?.data?.some((item: any) =>
      Array.isArray(item.horariosVagos)
        ? item.horariosVagos.includes(horario)
        : false,
    );

    if (!agenda?.data?.length || !horarioDisponivel) {
      throw new ConflictException(
        `Horário ${horario} não está disponível para o profissional ${payload.profissionalId}.`,
      );
    }

    return payload;
  }

  prepareCreateAgendamentoRequest(
    payload: TrinksCreateAgendamentoPayload,
  ): TrinksCreateAgendamentoRequest {
    const { apiKey, baseUrl, estabelecimentoId } =
      this.trinksService.getApiConfig();
    const url = this.trinksService.buildApiUrl('/agendamentos', baseUrl);

    const body: TrinksCreateAgendamentoPayload = {
      servicoId: payload.servicoId,
      clienteId: payload.clienteId,
      profissionalId:
        payload.profissionalId !== undefined ? payload.profissionalId : null,
      dataHoraInicio: payload.dataHoraInicio,
      duracaoEmMinutos: payload.duracaoEmMinutos,
      valor: payload.valor,
      observacoes:
        payload.observacoes !== undefined ? payload.observacoes : null,
      confirmado: payload.confirmado ?? false,
    };

    return {
      method: 'POST',
      url: url.toString(),
      headers: {
        'X-Api-Key': apiKey,
        estabelecimentoId,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body,
    };
  }

  async createAgendamento(
    request: TrinksCreateAgendamentoRequest,
  ): Promise<unknown> {
    let response: Response;

    try {
      response = await (globalThis as any).fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify(request.body),
      });
    } catch (error) {
      this.logger.error(
        'Failed to communicate with Trinks API while creating an appointment',
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
        'Invalid JSON received from Trinks API while creating an appointment',
        error as Error,
      );
      throw new HttpException(
        'Invalid response from Trinks API',
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (response.ok) {
      return payload;
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

  async getAgenda(query: TrinksAgendaQuery): Promise<TrinksAgendaResponse> {
    const { apiKey, baseUrl, estabelecimentoId } =
      this.trinksService.getApiConfig();
    const dateSegment = query.data
      ? `/${this.trinksService.normalizeTrinksDatePath(query.data)}`
      : '';
    const url = this.trinksService.buildApiUrl(
      `/agendamentos/profissionais${dateSegment}`,
      baseUrl,
    );

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
    const agenda = await this.getAgenda(query);

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
