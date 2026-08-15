import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { TrinksService } from '../trinks.service';
import {
  TrinksProfissionaisResponse,
  TrinksProfissionaisQuery,
  TrinksProfissional,
  TrinksProfissionalServico,
} from './profissionais.types';

@Injectable()
export class ProfissionaisService {
  private readonly logger = new Logger(ProfissionaisService.name);

  constructor(private readonly trinksService: TrinksService) {}

  async getProfissionais(
    query: TrinksProfissionaisQuery,
  ): Promise<TrinksProfissionaisResponse<TrinksProfissional>> {
    const { apiKey, baseUrl, estabelecimentoId } =
      this.trinksService.getApiConfig();
    const url = this.trinksService.buildApiUrl('/profissionais', baseUrl);

    if (query.page !== undefined) {
      url.searchParams.set('page', String(query.page));
    }
    if (query.pageSize !== undefined) {
      url.searchParams.set('pageSize', String(query.pageSize));
    }
    if (query.nome !== undefined) {
      url.searchParams.set('nome', String(query.nome));
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
      return payload as TrinksProfissionaisResponse<TrinksProfissional>;
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

  async getServicosDoProfissional(
    profissionalId: number,
  ): Promise<TrinksProfissionalServico[]> {
    const { apiKey, baseUrl, estabelecimentoId } =
      this.trinksService.getApiConfig();
    const url = this.trinksService.buildApiUrl(
      `/profissionais/${profissionalId}/servicos`,
      baseUrl,
    );

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
      // Expect an array of services
      return Array.isArray(payload)
        ? (payload as TrinksProfissionalServico[])
        : [];
    }

    this.logger.error(
      `Trinks API returned unexpected status ${response.status}`,
      payload as Error,
    );
    throw new HttpException(
      'Trinks API returned an unexpected error',
      HttpStatus.BAD_GATEWAY,
    );
  }

  async getProfissionaisPorCategoria(
    servicoCategoriaEstabelecimentoId: number,
    query?: TrinksProfissionaisQuery,
  ): Promise<TrinksProfissionaisResponse<TrinksProfissional>> {
    const { apiKey, baseUrl, estabelecimentoId } =
      this.trinksService.getApiConfig();
    const url = this.trinksService.buildApiUrl(
      `/${servicoCategoriaEstabelecimentoId}`,
      baseUrl.replace(/\/v1$/, ''),
    );

    // The Trinks path provided is /profissionais/{servicoCategoriaEstabelecimentoId}
    // buildApiUrl expects a path starting with /, and will add /v1 if missing.
    const profissionaisUrl = this.trinksService.buildApiUrl(
      `/profissionais/${servicoCategoriaEstabelecimentoId}`,
      baseUrl,
    );

    if (query?.page !== undefined) {
      profissionaisUrl.searchParams.set('page', String(query.page));
    }
    if (query?.pageSize !== undefined) {
      profissionaisUrl.searchParams.set('pageSize', String(query.pageSize));
    }

    const headers = {
      'X-Api-Key': apiKey,
      estabelecimentoId,
      Accept: 'application/json',
    };

    let response: Response;

    try {
      response = await (globalThis as any).fetch(profissionaisUrl.toString(), {
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
      return payload as TrinksProfissionaisResponse<TrinksProfissional>;
    }

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
