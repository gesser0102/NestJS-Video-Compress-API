import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../../.env') });

export const config = {
  gcpProjectId: process.env.GCP_PROJECT_ID || '',
  gcsBucket: process.env.GCS_BUCKET || '',
  videoProcessingSubscription: process.env.VIDEO_PROCESSING_SUBSCRIPTION || 'video-processing-subscription',
  maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3', 10),
  retryBackoffMs: parseInt(process.env.RETRY_BACKOFF_MS || '5000', 10),
  firebase: {
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
  },
  
  ffmpeg: {
    preset: process.env.FFMPEG_PRESET || 'fast',
    crf: parseInt(process.env.FFMPEG_CRF || '23', 10),
    threads: parseInt(process.env.FFMPEG_THREADS || '0', 10),
    maxBitrate: parseInt(process.env.FFMPEG_MAX_BITRATE || '8000', 10),
    targetResolution: process.env.FFMPEG_TARGET_RESOLUTION || '854x480',
  },
  
  processing: {
    maxFileSizeMB: parseInt(process.env.MAX_PROCESSING_FILE_SIZE_MB || '2000', 10),
    tempDirCleanupDelayMs: parseInt(process.env.TEMP_DIR_CLEANUP_DELAY_MS || '60000', 10),
    concurrentUploads: parseInt(process.env.CONCURRENT_UPLOADS || '2', 10),
  },
};

const requiredVars = ['GCP_PROJECT_ID', 'GCS_BUCKET', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
requiredVars.forEach(varName => {
  if (!process.env[varName]) {
    console.warn(`Missing environment variable: ${varName}`);
  }
});