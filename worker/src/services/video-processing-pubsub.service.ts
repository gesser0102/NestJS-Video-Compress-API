import { PubSub, Message } from '@google-cloud/pubsub';
import { config } from '../config';
import { VideoProcessorService } from './video-processor.service';
import { NotificationPublisherService } from './notification-publisher.service';
import axios from 'axios';

export interface VideoProcessingMessage {
  videoId: string;
  objectName: string;
  fileName: string;
  contentType: string;
  action: 'process' | 'retry';
  retryCount?: number;
}

export class VideoProcessingPubSubService {
  private pubsub!: PubSub;
  private subscription: any;
  private topicName = 'video-processing';
  private notificationService: NotificationPublisherService;
  private serverBaseUrl: string;

  constructor(
    private videoProcessor: VideoProcessorService,
  ) {
    this.notificationService = new NotificationPublisherService();
    this.serverBaseUrl = process.env.SERVER_BASE_URL || 'http://server:3000';
    
    try {
      const privateKey = config.firebase.privateKey.replace(/\\n/g, '\n');
      
      this.pubsub = new PubSub({
        projectId: config.gcpProjectId,
        credentials: {
          client_email: config.firebase.clientEmail,
          private_key: privateKey,
        },
      });
      this.subscription = this.pubsub.subscription(config.videoProcessingSubscription);
    } catch (error) {
      console.error('Failed to initialize Video Processing PubSub client:', error);
      this.pubsub = null as any;
      this.subscription = null;
    }
  }

  async startListening(): Promise<void> {
    if (!this.subscription) {
      console.error('Video Processing PubSub subscription not available');
      return;
    }

    try {
      const [exists] = await this.subscription.exists();
      if (!exists) {
        const topic = this.pubsub.topic(this.topicName);
        const [topicExists] = await topic.exists();
        if (!topicExists) {
          await topic.create();
        }
        await topic.createSubscription(config.videoProcessingSubscription);
      }
    } catch (error) {
      console.error('Failed to ensure subscription exists:', error);
      return;
    }

    this.subscription.options = {
      ackDeadlineSeconds: 300,
      maxMessages: 1,
      allowExcessMessages: false,
    };

    this.subscription.on('message', this.handleMessage.bind(this));
    this.subscription.on('error', (error: Error) => {
      console.error('Video Processing PubSub subscription error:', error);
      
      setTimeout(() => {
        this.startListening();
      }, 10000);
    });

    process.on('SIGINT', () => {
      if (this.subscription) {
        this.subscription.close();
      }
    });
  }

  private async handleMessage(message: Message): Promise<void> {
    try {
      const messageData: VideoProcessingMessage = JSON.parse(message.data.toString());

      await this.processVideoMessage(messageData);
      message.ack();
    } catch (error) {
      console.error('Error processing video message:', error);
      message.nack();
    }
  }

  private async processVideoMessage(messageData: VideoProcessingMessage): Promise<void> {
    const { videoId, objectName, retryCount = 0 } = messageData;

    const videoExists = await this.checkVideoExists(videoId);
    if (!videoExists) {
      console.warn(`Video ${videoId} not found, skipping orphaned message for ${objectName}`);
      return;
    }

    let currentRetryCount = retryCount;
    const maxRetries = config.maxRetryAttempts;

    while (currentRetryCount <= maxRetries) {
      try {
        await this.videoProcessor.processVideo(videoId, objectName);
        return;
      } catch (error) {
        currentRetryCount++;
        console.error(`Processing failed for video ${videoId} (attempt ${currentRetryCount}/${maxRetries + 1}):`, error);

        if (currentRetryCount > maxRetries) {
          await this.notificationService.notifyProcessingFailed(videoId, error instanceof Error ? error.message : String(error));
          return;
        }

        const backoffMs = config.retryBackoffMs * Math.pow(2, currentRetryCount - 1);
        await this.sleep(backoffMs);
      }
    }
  }

  private async checkVideoExists(videoId: string): Promise<boolean> {
    try {
      const response = await axios.get(`${this.serverBaseUrl}/api/videos/${videoId}`, {
        timeout: 5000,
        validateStatus: (status) => status === 200 || status === 404
      });
      return response.status === 200;
    } catch (error) {
      console.error(`Failed to check if video ${videoId} exists:`, error);
      return true;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}