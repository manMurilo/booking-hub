import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { TrinksService } from '../trinks.service';
import {
  AssinaturaDTO,
  AssinaturasResponse,
  AssinaturasQuery,
} from './assinaturas.types';

@Injectable()
export class AssinaturasService {
  private readonly logger = new Logger(AssinaturasService.name);

  constructor(private readonly trinksService: TrinksService) {}

  async getAssinaturas(
    query: AssinaturasQuery,
  ): Promise<AssinaturasResponse<AssinaturaDTO>> {
    const { apiKey, baseUrl, estabelecimentoId } =
      this.trinksService.getApiConfig();
    const url = this.trinksService.buildApiUrl('/clube/assinaturas', baseUrl);

    if (query.page !== undefined) {
      url.searchParams.set('page', String(query.page));
    }
    if (query.pageSize !== undefined) {
      url.searchParams.set('pageSize', String(query.pageSize));
    }
    if (query.clienteCpf !== undefined) {
      url.searchParams.set('clienteCpf', String(query.clienteCpf));
    }
    if (query.clienteNome !== undefined) {
      url.searchParams.set('clienteNome', String(query.clienteNome));
    }
    if (query.planoId !== undefined) {
      url.searchParams.set('planoId', String(query.planoId));
    }
    if (query.status !== undefined) {
      url.searchParams.set('status', String(query.status));
    }
    if (query.ordenarPor !== undefined) {
      url.searchParams.set('ordenarPor', String(query.ordenarPor));
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
      return payload as AssinaturasResponse<AssinaturaDTO>;
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
