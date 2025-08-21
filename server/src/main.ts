import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NotificationPubSubService } from './pubsub/notification-pubsub.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { CustomValidationPipe } from './common/pipes/validation.pipe';
import { CustomLoggerService } from './common/logger/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(CustomLoggerService);
  app.useLogger(logger);

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(new CustomValidationPipe());

  app.enableCors({
    origin: process.env.WEBSOCKET_CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

  try {
    const notificationPubSubService = app.get(NotificationPubSubService);
    await notificationPubSubService.startListening();
    logger.log('Notification PubSub listener started', 'Bootstrap');
  } catch (error) {
    logger.error('Failed to start PubSub listener', error.stack, 'Bootstrap');
    throw error;
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Server running on port ${port}`, 'Bootstrap');
}
bootstrap();
