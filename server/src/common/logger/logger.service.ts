import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';

@Injectable()
export class CustomLoggerService implements LoggerService {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(
          ({ timestamp, level, message, context, trace, ...meta }) => {
            const logObject: any = {
              timestamp,
              level,
              message,
              context,
            };

            if (trace) {
              logObject.trace = trace;
            }

            if (meta && Object.keys(meta).length > 0) {
              logObject.meta = meta;
            }

            return JSON.stringify(logObject);
          },
        ),
      ),
      defaultMeta: {
        service: 'trakto-server',
        environment: process.env.NODE_ENV || 'development',
      },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(
              ({ timestamp, level, message, context, trace }) => {
                const contextStr = context ? ` [${context}]` : '';
                const traceStr = trace ? `\n${trace}` : '';
                return `${timestamp} ${level}${contextStr} ${message}${traceStr}`;
              },
            ),
          ),
        }),

        new DailyRotateFile({
          filename: 'logs/application-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),

        new DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: '20m',
          maxFiles: '30d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      ],
    });

    this.ensureLogsDirectory();
  }

  private ensureLogsDirectory(): void {
    const fs = require('fs');
    const path = require('path');
    const logsDir = path.join(process.cwd(), 'logs');

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  log(message: string, context?: string): void {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, { context, trace });
  }

  warn(message: string, context?: string): void {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string): void {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string): void {
    this.logger.verbose(message, { context });
  }

  logWithMeta(
    level: string,
    message: string,
    meta: any,
    context?: string,
  ): void {
    this.logger.log(level, message, { context, ...meta });
  }

  logApiRequest(
    method: string,
    url: string,
    statusCode: number,
    responseTime: number,
    userId?: string,
  ): void {
    this.logger.info('API Request', {
      context: 'HTTP',
      method,
      url,
      statusCode,
      responseTime,
      userId,
    });
  }

  logVideoProcessing(
    videoId: string,
    status: string,
    progress: number,
    error?: string,
  ): void {
    this.logger.info('Video Processing', {
      context: 'VideoProcessor',
      videoId,
      status,
      progress,
      ...(error && { error }),
    });
  }

  logStorageOperation(
    operation: string,
    objectName: string,
    success: boolean,
    error?: string,
  ): void {
    this.logger.info('Storage Operation', {
      context: 'Storage',
      operation,
      objectName,
      success,
      ...(error && { error }),
    });
  }

  logPubSubMessage(
    topic: string,
    messageId: string,
    action: string,
    success: boolean,
  ): void {
    this.logger.info('PubSub Message', {
      context: 'PubSub',
      topic,
      messageId,
      action,
      success,
    });
  }
}
