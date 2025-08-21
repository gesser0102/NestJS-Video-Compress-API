import { PubSub } from '@google-cloud/pubsub';
import { config } from '../config';

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

export class NotificationPublisherService {
  private pubsub!: PubSub;
  private topicName = 'video-notifications';

  constructor() {
    try {
      const privateKey = config.firebase.privateKey.replace(/\\n/g, '\n');
      
      this.pubsub = new PubSub({
        projectId: config.gcpProjectId,
        credentials: {
          client_email: config.firebase.clientEmail,
          private_key: privateKey,
        },
      });
    } catch (error) {
      console.error('Failed to initialize Notification Publisher Service:', error);
      throw error;
    }
  }

  private async publishNotification(message: VideoNotificationMessage): Promise<void> {
    try {
      const topic = this.pubsub.topic(this.topicName);
      
      const [exists] = await topic.exists();
      if (!exists) {
        await topic.create();
      }

      const messageBuffer = Buffer.from(JSON.stringify(message));
      const messageId = await topic.publish(messageBuffer);
    } catch (error) {
      console.error(`Failed to publish ${message.type} notification for video ${message.videoId}:`, error);
      throw error;
    }
  }

  async notifyProgress(videoId: string, status: string, progress: number, error?: string): Promise<void> {
    const message: VideoNotificationMessage = {
      type: 'progress',
      videoId,
      status,
      progress,
      error,
      timestamp: Date.now(),
    };

    await this.publishNotification(message);
  }

  async notifyProcessingStart(videoId: string): Promise<void> {
    await this.notifyProgress(videoId, 'processing', 0);
  }

  async notifyProcessingProgress(videoId: string, progress: number): Promise<void> {
    await this.notifyProgress(videoId, 'processing', progress);
  }

  async notifyProcessingComplete(videoId: string, metadata?: any): Promise<void> {
    const message: VideoNotificationMessage = {
      type: 'complete',
      videoId,
      status: 'done',
      progress: 100,
      metadata,
      timestamp: Date.now(),
    };

    await this.publishNotification(message);
  }

  async notifyProcessingCompleteWithMetadata(
    videoId: string, 
    lowResPath: string, 
    thumbnailPath: string, 
    metadata: any
  ): Promise<void> {
    const message: VideoNotificationMessage = {
      type: 'complete',
      videoId,
      status: 'done',
      progress: 100,
      lowResPath,
      thumbnailPath,
      metadata,
      timestamp: Date.now(),
    };

    await this.publishNotification(message);
  }

  async notifyProcessingFailed(videoId: string, error: string): Promise<void> {
    const message: VideoNotificationMessage = {
      type: 'failed',
      videoId,
      status: 'failed',
      progress: 0,
      error,
      timestamp: Date.now(),
    };

    await this.publishNotification(message);
  }

}