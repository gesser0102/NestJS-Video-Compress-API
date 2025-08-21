import { Injectable, Logger } from '@nestjs/common';
import { PubSub, Message } from '@google-cloud/pubsub';
import { AppConfigService } from '../config/config.service';
import { VideosService } from '../videos/videos.service';
import { WebSocketGateway } from '../websocket/websocket.gateway';

export interface VideoNotificationMessage {
  type: 'progress' | 'complete' | 'failed';
  videoId: string;
  status?: string;
  progress?: number;
  error?: string;
  lowResPath?: string;
  thumbnailPath?: string;
  metadata?: any;
  timestamp?: number;
}

@Injectable()
export class NotificationPubSubService {
  private readonly logger = new Logger(NotificationPubSubService.name);
  private pubsub: PubSub;
  private subscription: any;
  private topicName = 'video-notifications';
  private subscriptionName = 'video-notifications-subscription';

  constructor(
    private configService: AppConfigService,
    private videosService: VideosService,
    private webSocketGateway: WebSocketGateway,
  ) {
    try {
      this.pubsub = new PubSub({
        projectId: this.configService.gcpProjectId,
        credentials: {
          client_email: this.configService.firebaseClientEmail,
          private_key: this.configService.firebasePrivateKey.replace(
            /\\n/g,
            '\n',
          ),
        },
      });
      this.subscription = this.pubsub.subscription(this.subscriptionName);
      this.logger.log('✅ Notification PubSub client initialized successfully');
    } catch (error) {
      this.logger.error(
        '❌ Failed to initialize Notification PubSub client:',
        error,
      );
      throw error;
    }
  }

  async startListening(): Promise<void> {
    try {
      const [exists] = await this.subscription.exists();
      if (!exists) {
        const topic = this.pubsub.topic(this.topicName);
        const [topicExists] = await topic.exists();
        if (!topicExists) {
          await topic.create();
        }
        await topic.createSubscription(this.subscriptionName);
      }
    } catch (error) {
      this.logger.error(
        'Failed to ensure notification subscription exists:',
        error,
      );
      return;
    }

    this.subscription.options = {
      ackDeadlineSeconds: 60,
      maxMessages: 10,
      allowExcessMessages: false,
    };

    this.subscription.on('message', this.handleMessage.bind(this));
    this.subscription.on('error', (error: Error) => {
      this.logger.error('Notification PubSub subscription error:', error);

      setTimeout(() => {
        this.startListening();
      }, 10000);
    });

    this.logger.log('Notification PubSub listener started successfully');
  }

  private async handleMessage(message: Message): Promise<void> {
    try {
      const messageData: VideoNotificationMessage = JSON.parse(
        message.data.toString(),
      );

      await this.processNotificationMessage(messageData);
      message.ack();
    } catch (error) {
      this.logger.error('Error processing notification message:', error);
      message.nack();
    }
  }

  private async processNotificationMessage(
    message: VideoNotificationMessage,
  ): Promise<void> {
    const { type, videoId } = message;

    try {
      switch (type) {
        case 'progress':
          await this.handleProgressNotification(message);
          break;
        case 'complete':
          await this.handleCompleteNotification(message);
          break;
        case 'failed':
          await this.handleFailedNotification(message);
          break;
        default:
          this.logger.warn(`Unknown notification type: ${type}`);
      }
    } catch (error) {
      this.logger.error(
        `❌ Failed to process ${type} notification for video ${videoId}:`,
        error,
      );
      throw error;
    }
  }

  private async handleProgressNotification(
    message: VideoNotificationMessage,
  ): Promise<void> {
    const { videoId, status, progress, error, timestamp } = message;

    if (!(await this.videosService.videoExists(videoId))) {
      this.logger.warn(
        `Video ${videoId} not found, skipping progress notification`,
      );
      return;
    }

    const updateResult = await this.videosService.updateVideoProgress(
      videoId,
      status!,
      progress!,
      error,
      timestamp,
    );

    if (updateResult) {
      this.webSocketGateway.notifyVideoProgress(videoId, progress!, status!);
    } else {
      this.logger.warn(
        `Progress update ignored for video ${videoId} - timestamp ${timestamp} is older than current`,
      );
    }
  }

  private async handleCompleteNotification(
    message: VideoNotificationMessage,
  ): Promise<void> {
    const { videoId, lowResPath, thumbnailPath, metadata } = message;

    if (!(await this.videosService.videoExists(videoId))) {
      this.logger.warn(
        `Video ${videoId} not found, skipping completion notification`,
      );
      return;
    }

    if (lowResPath && thumbnailPath) {
      await this.videosService.updateVideoProcessingComplete(
        videoId,
        lowResPath,
        thumbnailPath,
        metadata,
      );
    } else {
      await this.videosService.updateVideoProgress(videoId, 'done', 100);
    }

    this.webSocketGateway.notifyVideoCompleted(videoId, lowResPath || '');
  }

  private async handleFailedNotification(
    message: VideoNotificationMessage,
  ): Promise<void> {
    const { videoId, error } = message;

    if (!(await this.videosService.videoExists(videoId))) {
      this.logger.warn(
        `Video ${videoId} not found, skipping failure notification`,
      );
      return;
    }

    await this.videosService.updateVideoProgress(videoId, 'failed', 0, error);
    this.webSocketGateway.notifyVideoFailed(videoId, error || 'Unknown error');
  }
}
