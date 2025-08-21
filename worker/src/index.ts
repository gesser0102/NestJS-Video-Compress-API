import { GcsService } from './services/gcs.service';
import { VideoProcessorService } from './services/video-processor.service';
import { VideoProcessingPubSubService } from './services/video-processing-pubsub.service';
import * as http from 'http';

async function startHealthServer() {
  const port = process.env.PORT || 8080;
  
  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'healthy', 
        service: 'trakto-worker',
        timestamp: new Date().toISOString()
      }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  server.listen(port, () => {
    console.log(`📡 Health server running on port ${port}`);
  });

  return server;
}

async function main() {
  console.log('🚀 Starting video processing worker...');

  try {
    await startHealthServer();
    
    const gcsService = new GcsService();
    const videoProcessor = new VideoProcessorService(gcsService);
    
    const videoProcessingPubSubService = new VideoProcessingPubSubService(videoProcessor);

    console.log('🔄 Starting Video Processing PubSub listener...');
    await videoProcessingPubSubService.startListening();
    
    console.log('✅ Worker is ready and listening for Pub/Sub messages');
    console.log('📨 - Video processing via Pub/Sub only');
  } catch (error) {
    console.error('❌ Failed to start worker:', error);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

main().catch((error) => {
  console.error('Worker startup error:', error);
  process.exit(1);
});