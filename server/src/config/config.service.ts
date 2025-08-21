import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  get gcpProjectId(): string {
    return this.configService.get<string>('GCP_PROJECT_ID') || '';
  }

  get gcsBucket(): string {
    return this.configService.get<string>('GCS_BUCKET') || '';
  }


  get pubsubSubscription(): string {
    return this.configService.get<string>('PUBSUB_SUBSCRIPTION') || '';
  }

  get signUrlExpirationSeconds(): number {
    return this.configService.get<number>('SIGN_URL_EXPIRATION_SECONDS', 900);
  }

  get firebaseProjectId(): string {
    return this.configService.get<string>('FIREBASE_PROJECT_ID') || '';
  }

  get firebaseClientEmail(): string {
    return this.configService.get<string>('FIREBASE_CLIENT_EMAIL') || '';
  }

  get firebasePrivateKey(): string {
    return this.configService.get<string>('FIREBASE_PRIVATE_KEY') || '';
  }

  get port(): number {
    return this.configService.get<number>('PORT', 3000);
  }

  get websocketCorsOrigin(): string {
    return this.configService.get<string>(
      'WEBSOCKET_CORS_ORIGIN',
      'http://localhost:5173',
    );
  }

  get internalApiSecret(): string {
    return this.configService.get<string>('INTERNAL_API_SECRET') || '';
  }

  get websocketHeartbeatInterval(): number {
    return this.configService.get<number>(
      'WEBSOCKET_HEARTBEAT_INTERVAL',
      25000,
    );
  }

  get websocketHeartbeatTimeout(): number {
    return this.configService.get<number>('WEBSOCKET_HEARTBEAT_TIMEOUT', 60000);
  }

  get maxRetryAttempts(): number {
    return this.configService.get<number>('MAX_RETRY_ATTEMPTS', 3);
  }

  get retryBackoffMs(): number {
    return this.configService.get<number>('RETRY_BACKOFF_MS', 5000);
  }

  get maxFileSizeMb(): number {
    return this.configService.get<number>('MAX_FILE_SIZE_MB', 500);
  }

  get allowedVideoTypes(): string[] {
    const types = this.configService.get<string>(
      'ALLOWED_VIDEO_TYPES',
      'video/mp4,video/webm,video/quicktime,video/x-msvideo',
    );
    return types.split(',');
  }
}
