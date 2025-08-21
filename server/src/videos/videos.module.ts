import { Module, forwardRef } from '@nestjs/common';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { GcsModule } from '../gcs/gcs.module';
import { PubSubModule } from '../pubsub/pubsub.module';
import { AppConfigService } from '../config/config.service';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    FirebaseModule,
    GcsModule,
    PubSubModule,
    forwardRef(() => WebSocketModule),
  ],
  controllers: [VideosController],
  providers: [VideosService, AppConfigService],
  exports: [VideosService],
})
export class VideosModule {}
