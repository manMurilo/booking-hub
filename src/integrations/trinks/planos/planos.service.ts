import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { TrinksService } from '../trinks.service';
import { PlanoClienteDTO, PlanosResponse, PlanosQuery } from './planos.types';

@Injectable()
export class PlanosService {
  private readonly logger = new Logger(PlanosService.name);

  constructor(private readonly trinksService: TrinksService) {}

  async getPlanos(
    query: PlanosQuery,
  ): Promise<PlanosResponse<PlanoClienteDTO>> {
    const { apiKey, baseUrl, estabelecimentoId } =
      this.trinksService.getApiConfig();
    const url = this.trinksService.buildApiUrl('/clube/planos', baseUrl);

    if (query.page !== undefined) {
      url.searchParams.set('page', String(query.page));
    }
    if (query.pageSize !== undefined) {
      url.searchParams.set('pageSize', String(query.pageSize));
    }
    if (query.somenteAtivos !== undefined) {
      url.searchParams.set('somenteAtivos', String(query.somenteAtivos));
    }
    if (query.ordenarPor !== undefined) {
      url.searchParams.set('ordenarPor', String(query.ordenarPor));
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
      return payload as PlanosResponse<PlanoClienteDTO>;
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
        this.logger.warn('Trinks API rate limit reached');
        throw new HttpException(
          'Trinks API rate limit exceeded',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      default:
        throw new HttpException(
          payload || 'Unknown error from Trinks API',
          HttpStatus.BAD_GATEWAY,
        );
    }
  }
}
