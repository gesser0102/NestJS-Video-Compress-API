import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string;
  error: string;
  requestId?: string;
  details?: any;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception, request);

    this.logError(exception, request, errorResponse);

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private buildErrorResponse(
    exception: unknown,
    request: Request,
  ): ErrorResponse {
    const timestamp = new Date().toISOString();
    const path = request.url;
    const method = request.method;
    const requestId = this.generateRequestId();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const customResponse = exceptionResponse as any;
        return {
          statusCode: status,
          timestamp,
          path,
          method,
          requestId,
          message: customResponse.message || exception.message,
          error: customResponse.error || exception.name,
          details: this.extractDetails(customResponse),
        };
      }

      return {
        statusCode: status,
        timestamp,
        path,
        method,
        requestId,
        message: exception.message,
        error: exception.name,
      };
    }

    if (exception instanceof Error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        timestamp,
        path,
        method,
        requestId,
        message: 'Internal server error',
        error: 'INTERNAL_SERVER_ERROR',
        details:
          process.env.NODE_ENV === 'development'
            ? {
                originalError: exception.message,
                stack: exception.stack,
              }
            : undefined,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp,
      path,
      method,
      requestId,
      message: 'Unknown error occurred',
      error: 'UNKNOWN_ERROR',
    };
  }

  private extractDetails(customResponse: any): any {
    const details: any = {};

    Object.keys(customResponse).forEach((key) => {
      if (!['message', 'error', 'statusCode'].includes(key)) {
        details[key] = customResponse[key];
      }
    });

    return Object.keys(details).length > 0 ? details : undefined;
  }

  private logError(
    exception: unknown,
    request: Request,
    errorResponse: ErrorResponse,
  ): void {
    const { statusCode, requestId, path, method } = errorResponse;

    const logContext = {
      requestId,
      method,
      path,
      statusCode,
      userAgent: request.get('User-Agent'),
      ip: request.ip,
      userId: (request as any).user?.id,
    };

    if (statusCode >= 500) {
      this.logger.error(
        `${method} ${path} - ${statusCode}`,
        exception instanceof Error ? exception.stack : exception,
        logContext,
      );
    } else if (statusCode >= 400) {
      this.logger.warn(
        `${method} ${path} - ${statusCode}: ${errorResponse.message}`,
        logContext,
      );
    } else {
      this.logger.log(`${method} ${path} - ${statusCode}`, logContext);
    }
  }

  private generateRequestId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}
