import { Injectable, Logger } from '@nestjs/common';
import { PubSub } from '@google-cloud/pubsub';
import { AppConfigService } from '../config/config.service';

export interface VideoProcessingMessage {
  videoId: string;
  objectName: string;
  fileName: string;
  contentType: string;
  action: 'process' | 'retry';
  retryCount?: number;
}

@Injectable()
export class PubSubService {
  private readonly logger = new Logger(PubSubService.name);
  private pubsub: PubSub;
  private topicName = 'video-processing';

  constructor(private configService: AppConfigService) {
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
      this.logger.log('✅ PubSub client initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize PubSub client:', error);
      throw error;
    }
  }

  async publishVideoProcessingMessage(
    message: VideoProcessingMessage,
  ): Promise<void> {
    try {
      const topic = this.pubsub.topic(this.topicName);

      const [exists] = await topic.exists();
      if (!exists) {
        await topic.create();
      }

      const messageBuffer = Buffer.from(JSON.stringify(message));
      const messageId = await topic.publish(messageBuffer);

      this.logger.log(
        `Published message ${messageId} for video ${message.videoId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish message for video ${message.videoId}:`,
        error,
      );
      throw error;
    }
  }

  async publishVideoProcessing(
    videoId: string,
    objectName: string,
    fileName: string,
    contentType: string,
    retryCount: number = 0,
  ): Promise<void> {
    const message: VideoProcessingMessage = {
      videoId,
      objectName,
      fileName,
      contentType,
      action: retryCount > 0 ? 'retry' : 'process',
      retryCount,
    };

    await this.publishVideoProcessingMessage(message);
  }
}
