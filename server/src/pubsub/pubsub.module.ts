import { Module, forwardRef } from '@nestjs/common';
import { PubSubService } from './pubsub.service';
import { NotificationPubSubService } from './notification-pubsub.service';
import { AppConfigService } from '../config/config.service';
import { VideosModule } from '../videos/videos.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [forwardRef(() => VideosModule), forwardRef(() => WebSocketModule)],
  providers: [PubSubService, NotificationPubSubService, AppConfigService],
  exports: [PubSubService, NotificationPubSubService],
})
export class PubSubModule {}
