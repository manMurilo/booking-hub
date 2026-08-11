import { Request, Response } from 'express';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const requestMethod =
      typeof request.method === 'string' ? request.method : 'UNKNOWN';
    const requestUrl =
      typeof request.url === 'string' ? request.url : 'UNKNOWN';

    this.logger.error(
      `HTTP Exception: ${JSON.stringify(message)} at ${requestMethod} ${requestUrl}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      statusCode: status,
      path: requestUrl,
      timestamp: new Date().toISOString(),
      message,
    });
  }
}
