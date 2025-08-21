import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { VideosModule } from './videos/videos.module';
import { WebSocketModule } from './websocket/websocket.module';
import { FirebaseModule } from './firebase/firebase.module';
import { GcsModule } from './gcs/gcs.module';
import { PubSubModule } from './pubsub/pubsub.module';
import { LoggerModule } from './common/logger/logger.module';

@Module({
  imports: [
    LoggerModule,
    ConfigModule,
    FirebaseModule,
    GcsModule,
    PubSubModule,
    VideosModule,
    WebSocketModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
