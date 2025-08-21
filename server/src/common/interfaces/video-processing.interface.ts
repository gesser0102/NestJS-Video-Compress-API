export interface VideoProcessing {
  id: string;
  originalFileName: string;
  sanitizedFileName?: string;
  originalGcsPath: string;
  lowResGcsPath?: string;
  thumbnailGcsPath?: string;
  status: 'queued' | 'processing' | 'done' | 'failed';
  progress: number;
  sizeBytes?: number;
  lowResSizeBytes?: number;
  originalResolution?: string;
  lowResolution?: string;
  durationSeconds?: number;
  error?: string;
  retryCount: number;
  lastRetryAt?: Date;
  lastProgressUpdate?: number;
  createdAt: Date;
  updatedAt: Date;
}
