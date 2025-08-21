import { Module, forwardRef } from '@nestjs/common';
import { WebSocketGateway } from './websocket.gateway';
import { AppConfigService } from '../config/config.service';
import { VideosModule } from '../videos/videos.module';

@Module({
  imports: [forwardRef(() => VideosModule)],
  providers: [WebSocketGateway, AppConfigService],
  exports: [WebSocketGateway],
})
export class WebSocketModule {}
