export interface VideoProcessing {
  id: string;
  originalFileName: string;
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

export interface UploadUrlResponse {
  signedUrl: string;
  objectName: string;
  bucket: string;
  videoId: string;
  expiresAt: string;
}

export interface VideoListResponse {
  items: VideoProcessing[];
  page: number;
  limit: number;
  total: number;
}