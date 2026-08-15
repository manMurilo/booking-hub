import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { TrinksService } from '../trinks.service';
import {
  TrinksClientesResponse,
  TrinksClientesQuery,
  TrinksCliente,
} from './clientes.types';
import { AddCliente, CreatedIdModel } from './clientes.types';

@Injectable()
export class ClientesService {
  private readonly logger = new Logger(ClientesService.name);

  constructor(private readonly trinksService: TrinksService) {}

  async getClientes(
    query: TrinksClientesQuery,
  ): Promise<TrinksClientesResponse<TrinksCliente>> {
    const { apiKey, baseUrl, estabelecimentoId } =
      this.trinksService.getApiConfig();
    const url = this.trinksService.buildApiUrl('/clientes', baseUrl);

    if (query.page !== undefined) {
      url.searchParams.set('page', String(query.page));
    }
    if (query.pageSize !== undefined) {
      url.searchParams.set('pageSize', String(query.pageSize));
    }
    if (query.nome !== undefined) {
      url.searchParams.set('nome', String(query.nome));
    }
    if (query.cpf !== undefined) {
      url.searchParams.set('cpf', String(query.cpf));
    }
    if (query.email !== undefined) {
      url.searchParams.set('email', String(query.email));
    }
    if (query.telefone !== undefined) {
      url.searchParams.set('telefone', String(query.telefone));
    }
    if (query.dataCadastroInicio !== undefined) {
      url.searchParams.set(
        'dataCadastroInicio',
        this.trinksService.normalizeTrinksDate(query.dataCadastroInicio),
      );
    }
    if (query.dataCadastroFim !== undefined) {
      url.searchParams.set(
        'dataCadastroFim',
        this.trinksService.normalizeTrinksDate(query.dataCadastroFim, true),
      );
    }
    if (query.dataAlteracaoCadastralInicio !== undefined) {
      url.searchParams.set(
        'dataAlteracaoCadastralInicio',
        this.trinksService.normalizeTrinksDate(
          query.dataAlteracaoCadastralInicio,
        ),
      );
    }
    if (query.dataAlteracaoCadastralFim !== undefined) {
      url.searchParams.set(
        'dataAlteracaoCadastralFim',
        this.trinksService.normalizeTrinksDate(
          query.dataAlteracaoCadastralFim,
          true,
        ),
      );
    }
    if (query.incluirDetalhes !== undefined) {
      url.searchParams.set('incluirDetalhes', String(query.incluirDetalhes));
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
      return payload as TrinksClientesResponse<TrinksCliente>;
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

  private formatTrinksErrorMessage(payload: unknown): string {
    if (!payload || typeof payload !== 'object') {
      return 'Trinks API returned an unexpected error';
    }

    const message = (payload as any).message;
    if (message && typeof message === 'object') {
      const errors = Array.isArray(message.Errors)
        ? message.Errors
        : Array.isArray(message.errors)
          ? message.errors
          : undefined;

      if (errors && errors.length > 0) {
        const details = errors
          .map((item: any) => {
            const propertyName =
              item?.PropertyName ?? item?.propertyName ?? 'Campo';
            const errorMessage =
              item?.ErrorMessage ?? item?.errorMessage ?? 'Inválido';
            return `${propertyName}: ${errorMessage}`;
          })
          .join('; ');

        return `Invalid request. ${details}`;
      }

      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }

    const detail = (payload as Record<string, unknown>).detail;
    if (typeof detail === 'string') {
      return detail;
    }

    return 'Trinks API returned an unexpected error';
  }

  private transformClientePayload(
    payload: AddCliente,
  ): Record<string, unknown> {
    // The Trinks API expects camelCase, not PascalCase
    // According to the OpenAPI spec, the schema uses lowercase field names
    return payload as unknown as Record<string, unknown>;
  }

  async createCliente(payload: AddCliente): Promise<CreatedIdModel> {
    const { apiKey, baseUrl, estabelecimentoId } =
      this.trinksService.getApiConfig();
    const url = this.trinksService.buildApiUrl('/clientes', baseUrl);

    const headers = {
      'X-Api-Key': apiKey,
      estabelecimentoId,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    const transformedPayload = this.transformClientePayload(payload);

    this.logger.debug(
      'Transformed client payload:',
      JSON.stringify(transformedPayload),
    );

    let response: Response;

    try {
      response = await (globalThis as any).fetch(url.toString(), {
        method: 'POST',
        headers,
        body: JSON.stringify(transformedPayload),
      });
    } catch (error) {
      this.logger.error(
        'Failed to communicate with Trinks API while creating a client',
        error as Error,
      );
      throw new HttpException(
        'Failed to communicate with Trinks API',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const responseText = await response.text();
    let parsed: unknown;

    this.logger.debug(
      `Trinks API response (status ${response.status}):`,
      responseText,
    );

    try {
      parsed = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
      this.logger.error(
        'Invalid JSON received from Trinks API while creating a client',
        error as Error,
      );
      throw new HttpException(
        'Invalid response from Trinks API',
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (response.status === HttpStatus.CREATED) {
      return parsed as CreatedIdModel;
    }

    const trinksErrorMessage = this.formatTrinksErrorMessage(parsed);

    switch (response.status) {
      case HttpStatus.UNAUTHORIZED:
      case HttpStatus.FORBIDDEN:
        throw new HttpException(
          'Trinks API authentication or authorization failed',
          HttpStatus.BAD_GATEWAY,
        );
      case HttpStatus.BAD_REQUEST:
        throw new HttpException(trinksErrorMessage, HttpStatus.BAD_REQUEST);
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
          {
            status: response.status,
            responseText,
            parsed,
          },
        );
        throw new HttpException(trinksErrorMessage, HttpStatus.BAD_GATEWAY);
    }
  }

  async getClientePorId(id: number): Promise<TrinksCliente> {
    const { apiKey, baseUrl, estabelecimentoId } =
      this.trinksService.getApiConfig();
    const url = this.trinksService.buildApiUrl(`/clientes/${id}`, baseUrl);

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
      return payload as TrinksCliente;
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
          payload as Error,
        );
        throw new HttpException(
          'Trinks API returned an unexpected error',
          HttpStatus.BAD_GATEWAY,
        );
    }
  }
}
