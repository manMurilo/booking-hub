import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TrinksAgendamentosResponse } from './trinks.types';

@Injectable()
export class TrinksService {
  private readonly logger = new Logger(TrinksService.name);

  constructor(private readonly configService: ConfigService) {}

  async getAgendamentos(query: { page?: number; pageSize?: number }): Promise<TrinksAgendamentosResponse> {
    const apiKey = this.configService.get<string>('TRINKS_API_KEY');
    const baseUrl = this.configService.get<string>('TRINKS_BASE_URL');
    const estabelecimentoId = this.configService.get<string>('TRINKS_ESTABELECIMENTO_ID');

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
      this.logger.error('Failed to communicate with Trinks API', error as Error);
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
      this.logger.error('Invalid JSON received from Trinks API', error as Error);
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

}
