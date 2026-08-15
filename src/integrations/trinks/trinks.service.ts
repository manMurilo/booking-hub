import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TrinksService {
  constructor(private readonly configService: ConfigService) {}

  getApiConfig(): {
    apiKey: string;
    baseUrl: string;
    estabelecimentoId: string;
  } {
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

    return { apiKey, baseUrl, estabelecimentoId };
  }

  buildApiUrl(path: string, baseUrl: string): URL {
    const base = new URL(baseUrl);
    const normalizedBasePath = base.pathname.replace(/\/$/, '');
    const requestPath = normalizedBasePath.endsWith('/v1')
      ? `${normalizedBasePath}${path}`
      : `${normalizedBasePath}/v1${path}`;

    return new URL(requestPath, base.origin);
  }

  normalizeTrinksDate(value: string, isEndOfDay = false): string {
    const brazilianDateMatch = /^\d{2}\/\d{2}\/\d{4}$/.test(value);
    if (!brazilianDateMatch) {
      return value;
    }

    const [day, month, year] = value.split('/');
    const formatted = `${year}-${month}-${day}`;
    return isEndOfDay ? `${formatted}T23:59:59` : `${formatted}T00:00:00`;
  }

  normalizeTrinksDatePath(value: string): string {
    const brazilianDateMatch = /^\d{2}\/\d{2}\/\d{4}$/.test(value);
    if (!brazilianDateMatch) {
      return value;
    }

    const [day, month, year] = value.split('/');
    return `${year}-${month}-${day}`;
  }
}
