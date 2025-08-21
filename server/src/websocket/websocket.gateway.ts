import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AppConfigService } from '../config/config.service';

@WSGateway({
  cors: {
    origin: process.env.WEBSOCKET_CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
  pingInterval: 25000,
  pingTimeout: 60000,
})
export class WebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private configService: AppConfigService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  notifyVideoProgress(videoId: string, progress: number, status: string) {
    console.log(
      `🔄 WebSocket: Notifying progress for video ${videoId}: ${status} - ${progress}%`,
    );

    this.server.emit('global-video-progress', {
      videoId,
      progress,
      status,
    });

    console.log(
      `✅ WebSocket: Global progress notification sent for video ${videoId}`,
    );
  }

  notifyVideoCompleted(videoId: string, lowResPath: string) {
    this.server.emit('global-video-completed', {
      videoId,
      lowResPath,
    });
  }

  notifyVideoFailed(videoId: string, error: string) {
    this.server.emit('global-video-failed', {
      videoId,
      error,
    });
  }
}
