import { HttpException, HttpStatus } from '@nestjs/common';

export class VideoNotFoundException extends HttpException {
  constructor(videoId: string) {
    super(
      {
        message: 'Video not found',
        error: 'VIDEO_NOT_FOUND',
        videoId,
        statusCode: HttpStatus.NOT_FOUND,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class VideoProcessingException extends HttpException {
  constructor(message: string, videoId?: string) {
    super(
      {
        message,
        error: 'VIDEO_PROCESSING_ERROR',
        videoId,
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class FileUploadException extends HttpException {
  constructor(message: string, fileName?: string) {
    super(
      {
        message,
        error: 'FILE_UPLOAD_ERROR',
        fileName,
        statusCode: HttpStatus.BAD_REQUEST,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class StorageException extends HttpException {
  constructor(message: string, operation?: string) {
    super(
      {
        message,
        error: 'STORAGE_ERROR',
        operation,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export class ValidationException extends HttpException {
  constructor(message: string, field?: string, value?: any) {
    super(
      {
        message,
        error: 'VALIDATION_ERROR',
        field,
        value,
        statusCode: HttpStatus.BAD_REQUEST,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class RateLimitException extends HttpException {
  constructor(limit: number, windowMs: number) {
    super(
      {
        message: 'Too many requests',
        error: 'RATE_LIMIT_EXCEEDED',
        limit,
        windowMs,
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class AuthenticationException extends HttpException {
  constructor(message: string = 'Authentication required') {
    super(
      {
        message,
        error: 'AUTHENTICATION_ERROR',
        statusCode: HttpStatus.UNAUTHORIZED,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class AuthorizationException extends HttpException {
  constructor(message: string = 'Insufficient permissions') {
    super(
      {
        message,
        error: 'AUTHORIZATION_ERROR',
        statusCode: HttpStatus.FORBIDDEN,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class ExternalServiceException extends HttpException {
  constructor(service: string, message: string, originalError?: any) {
    super(
      {
        message: `${service} service error: ${message}`,
        error: 'EXTERNAL_SERVICE_ERROR',
        service,
        originalError: originalError?.message || originalError,
        statusCode: HttpStatus.BAD_GATEWAY,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}

export class ConfigurationException extends HttpException {
  constructor(configKey: string, message?: string) {
    super(
      {
        message: message || `Configuration error for key: ${configKey}`,
        error: 'CONFIGURATION_ERROR',
        configKey,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
