import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}
  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    let cleanMessage: unknown;

    const ctx = host.switchToHttp();

    const message =
      exception instanceof HttpException
        ? exception['response']
        : String(exception);

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (typeof message === 'string') {
      cleanMessage = message.split(',');
    } else {
      if (typeof message['message'] === 'string') {
        cleanMessage = message['message'].split(',');
      } else {
        cleanMessage = message['message'];
      }
    }

    const responseBody = {
      statusCode: statusCode,
      timestamp: new Date().toISOString(),
      message: cleanMessage,
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, statusCode);
  }
}
