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
  TrinksAgendaProfessional,
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

  private toBrazilianDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  }

  private parseMinutes(value: string): number {
    if (!value || !/^\d{1,2}:\d{2}$/.test(value)) {
      return Number.NaN;
    }

    const [hours, minutes] = value.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return Number.NaN;
    }

    return hours * 60 + minutes;
  }

  private hasAvailableSlot(
    profissional: TrinksAgendaProfessional,
    dataHoraInicio: Date,
    duracaoEmMinutos: number,
  ): boolean {
    const horariosVagos = Array.isArray(profissional.horariosVagos)
      ? profissional.horariosVagos
      : [];

    if (horariosVagos.length === 0) {
      return false;
    }

    const requestedStartMinutes =
      dataHoraInicio.getHours() * 60 + dataHoraInicio.getMinutes();
    const requestedEndMinutes = requestedStartMinutes + duracaoEmMinutos;

    return horariosVagos.some((slot) => {
      if (typeof slot !== 'string') {
        return false;
      }

      if (slot.includes('-')) {
        const [inicio, fim] = slot.split('-');
        const inicioMinutes = this.parseMinutes(inicio);
        const fimMinutes = this.parseMinutes(fim);

        if (Number.isNaN(inicioMinutes) || Number.isNaN(fimMinutes)) {
          return false;
        }

        return (
          requestedStartMinutes >= inicioMinutes &&
          requestedEndMinutes <= fimMinutes
        );
      }

      const slotMinutes = this.parseMinutes(slot);
      if (Number.isNaN(slotMinutes)) {
        return false;
      }

      return (
        requestedStartMinutes >= slotMinutes &&
        requestedEndMinutes <= slotMinutes + duracaoEmMinutos
      );
    });
  }

  async validateLocalAgendamentoRules(
    payload: TrinksCreateAgendamentoPayload,
  ): Promise<void> {
    this.logger.log(
      `Validando regras locais de agendamento para cliente ${payload.clienteId} e serviço ${payload.servicoId}.`,
    );

    if (
      !Number.isFinite(payload.duracaoEmMinutos) ||
      payload.duracaoEmMinutos <= 0
    ) {
      throw new BadRequestException(
        'duracaoEmMinutos deve ser maior que zero.',
      );
    }

    if (!Number.isFinite(payload.valor) || payload.valor <= 0) {
      throw new BadRequestException('valor deve ser maior que zero.');
    }

    const dataHoraInicio = new Date(payload.dataHoraInicio);
    if (Number.isNaN(dataHoraInicio.getTime())) {
      throw new BadRequestException(
        'dataHoraInicio deve ser uma data válida em ISO-8601.',
      );
    }

    if (dataHoraInicio.getTime() <= Date.now()) {
      throw new ConflictException(
        'dataHoraInicio deve ser maior que a data e hora atuais.',
      );
    }

    try {
      await this.clientesService.getClientePorId(payload.clienteId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw new UnprocessableEntityException(
          `Cliente ${payload.clienteId} não foi encontrado na Trinks.`,
        );
      }

      throw error;
    }

    const servicosResponse = await this.servicosService.getServicos({
      id: payload.servicoId,
    });
    const servicoExiste = Array.isArray(servicosResponse.data)
      ? servicosResponse.data.some(
          (item) => Number(item.id) === payload.servicoId,
        )
      : false;

    if (!servicoExiste) {
      throw new UnprocessableEntityException(
        `servicoId ${payload.servicoId} não foi encontrado na Trinks.`,
      );
    }

    if (
      payload.profissionalId !== undefined &&
      payload.profissionalId !== null
    ) {
      const profissionaisResponse =
        await this.profissionaisService.getProfissionais({
          page: 1,
          pageSize: 500,
        });
      const profissionalExiste = Array.isArray(profissionaisResponse.data)
        ? profissionaisResponse.data.some(
            (item) => Number(item.id) === payload.profissionalId,
          )
        : false;

      if (!profissionalExiste) {
        throw new UnprocessableEntityException(
          `profissionalId ${payload.profissionalId} não foi encontrado na Trinks.`,
        );
      }

      const servicosDoProfissional =
        await this.profissionaisService.getServicosDoProfissional(
          payload.profissionalId,
        );
      const profissionalAtendeServico = servicosDoProfissional.some(
        (item) =>
          Number(item.id) === payload.servicoId ||
          Number(item.servicoId) === payload.servicoId,
      );

      if (!profissionalAtendeServico) {
        throw new ConflictException(
          'O profissional selecionado não atende ao serviço informado.',
        );
      }

      const agenda = await this.getAgenda({
        data: this.toBrazilianDate(dataHoraInicio),
        servicoId: payload.servicoId,
        servicoDuracao: payload.duracaoEmMinutos,
        profissionalId: payload.profissionalId,
      });

      const profissionalAgenda = Array.isArray(agenda.data)
        ? agenda.data.find((item) => Number(item.id) === payload.profissionalId)
        : undefined;

      if (!profissionalAgenda) {
        throw new ConflictException(
          'O profissional informado não possui agenda disponível para o horário solicitado.',
        );
      }

      const possuiHorarioDisponivel = this.hasAvailableSlot(
        profissionalAgenda,
        dataHoraInicio,
        payload.duracaoEmMinutos,
      );

      if (!possuiHorarioDisponivel) {
        throw new ConflictException(
          'O horário solicitado não está disponível para o profissional selecionado.',
        );
      }
    }
  }

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

  async prepareCreateAgendamentoRequest(
    payload: TrinksCreateAgendamentoPayload,
  ): Promise<TrinksCreateAgendamentoRequest> {
    await this.validateLocalAgendamentoRules(payload);

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
    this.logger.log(
      `Enviando agendamento para a Trinks: cliente ${request.body.clienteId}, serviço ${request.body.servicoId}.`,
    );

    await this.validateLocalAgendamentoRules(request.body);

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
