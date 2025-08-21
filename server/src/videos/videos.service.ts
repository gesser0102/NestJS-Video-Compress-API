import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { GcsService } from '../gcs/gcs.service';
import { PubSubService } from '../pubsub/pubsub.service';
import { VideoProcessing } from '../common/interfaces/video-processing.interface';
import { UploadUrlRequestDto } from './dto/upload-url-request.dto';
import { UploadUrlResponseDto } from './dto/upload-url-response.dto';
import { VideoListResponseDto } from './dto/video-list-response.dto';
import {
  VideoNotFoundException,
  VideoProcessingException,
  StorageException,
  ExternalServiceException,
} from '../common/exceptions/custom.exceptions';
import { v4 as uuidv4 } from 'uuid';
import * as admin from 'firebase-admin';
import { FilenameSanitizer } from '../common/utils/filename-sanitizer';

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);
  private readonly collection = 'videos';

  constructor(
    private firebaseService: FirebaseService,
    private gcsService: GcsService,
    private pubsubService: PubSubService,
  ) {}

  async generateUploadUrl(
    dto: UploadUrlRequestDto,
  ): Promise<UploadUrlResponseDto> {
    const videoId = uuidv4();

    try {
      const { signedUrl, objectName, bucket, expiresAt } =
        await this.gcsService.generateSignedUrl(
          dto.fileName,
          dto.contentType,
          videoId,
        );

      const videoProcessing: VideoProcessing = {
        id: videoId,
        originalFileName: dto.fileName,
        sanitizedFileName: FilenameSanitizer.sanitizeFilename(dto.fileName),
        originalGcsPath: objectName,
        status: 'queued',
        progress: 0,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const db = this.firebaseService.getFirestore();
      await db
        .collection(this.collection)
        .doc(videoId)
        .set({
          ...videoProcessing,
          createdAt: admin.firestore.Timestamp.fromDate(
            videoProcessing.createdAt,
          ),
          updatedAt: admin.firestore.Timestamp.fromDate(
            videoProcessing.updatedAt,
          ),
        });

      return {
        signedUrl,
        objectName,
        bucket,
        videoId,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate upload URL for video: ${videoId}`,
        error.stack,
      );

      if (
        error.message?.includes('storage') ||
        error.message?.includes('GCS')
      ) {
        throw new StorageException(
          'Failed to generate upload URL',
          'generateSignedUrl',
        );
      }

      if (
        error.message?.includes('firestore') ||
        error.message?.includes('firebase')
      ) {
        throw new ExternalServiceException(
          'Firebase',
          'Failed to save video record',
          error,
        );
      }

      throw new VideoProcessingException(
        `Failed to generate upload URL: ${error.message}`,
        videoId,
      );
    }
  }

  async getVideos(
    page: number = 1,
    limit: number = 20,
    status?: string,
    search?: string,
  ): Promise<VideoListResponseDto> {
    const db = this.firebaseService.getFirestore();
    let query = db.collection(this.collection).orderBy('createdAt', 'desc');

    if (status) {
      query = query.where('status', '==', status);
    }

    if (search) {
      query = query
        .where('originalFileName', '>=', search)
        .where('originalFileName', '<=', search + '\uf8ff');
    }

    const offset = (page - 1) * limit;
    const snapshot = await query.limit(limit).offset(offset).get();

    const items: VideoProcessing[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
        lastRetryAt: data.lastRetryAt?.toDate(),
      } as VideoProcessing;
    });

    const totalSnapshot = await query.get();
    const total = totalSnapshot.size;

    return {
      items,
      page,
      limit,
      total,
    };
  }

  async getVideoById(id: string): Promise<VideoProcessing> {
    try {
      const db = this.firebaseService.getFirestore();
      const doc = await db.collection(this.collection).doc(id).get();

      if (!doc.exists) {
        throw new VideoNotFoundException(id);
      }

      const data = doc.data();
      if (!data) {
        throw new VideoNotFoundException(id);
      }

      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
        lastRetryAt: data.lastRetryAt?.toDate(),
      } as VideoProcessing;
    } catch (error) {
      if (error instanceof VideoNotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to fetch video ${id}:`, error.stack);
      throw new ExternalServiceException(
        'Firebase',
        `Failed to fetch video: ${error.message}`,
        error,
      );
    }
  }

  async videoExists(id: string): Promise<boolean> {
    try {
      const db = this.firebaseService.getFirestore();
      const doc = await db.collection(this.collection).doc(id).get();
      return doc.exists;
    } catch (error) {
      this.logger.error(`Failed to check if video ${id} exists:`, error);
      return false;
    }
  }

  async updateVideoProgress(
    id: string,
    status: string,
    progress: number,
    error?: string,
    timestamp?: number,
  ): Promise<boolean> {
    const db = this.firebaseService.getFirestore();
    
    if (timestamp) {
      const currentVideo = await this.getVideoById(id);
      if (currentVideo.lastProgressUpdate && timestamp <= currentVideo.lastProgressUpdate) {
        return false;
      }
    }
    
    const updateData: any = {
      status,
      progress,
      updatedAt: admin.firestore.Timestamp.now(),
      lastProgressUpdate: timestamp || Date.now(),
    };

    if (error) {
      updateData.error = error;
    }

    await db.collection(this.collection).doc(id).update(updateData);
    return true;
  }

  async updateVideoProcessingComplete(
    id: string,
    lowResGcsPath: string,
    thumbnailGcsPath: string,
    metadata?: any,
  ): Promise<void> {
    const db = this.firebaseService.getFirestore();
    const updateData: any = {
      status: 'done',
      progress: 100,
      lowResGcsPath,
      thumbnailGcsPath,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    if (metadata) {
      updateData.sizeBytes = metadata.sizeBytes;
      updateData.lowResSizeBytes = metadata.lowResSizeBytes;
      updateData.originalResolution = metadata.originalResolution;
      updateData.lowResolution = metadata.lowResolution;
      updateData.durationSeconds = metadata.durationSeconds;
    }

    await db.collection(this.collection).doc(id).update(updateData);
  }

  async updateVideoStatus(
    id: string,
    status: string,
    progress?: number,
  ): Promise<void> {
    const db = this.firebaseService.getFirestore();
    const updateData: any = {
      status,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    if (progress !== undefined) {
      updateData.progress = progress;
    }

    await db.collection(this.collection).doc(id).update(updateData);
  }

  async validateUploadedFile(videoId: string, gcsPath: string): Promise<void> {
    try {
      // Download primeiro 1KB do arquivo para validação
      const fileBuffer = await this.gcsService.downloadFileBytes(gcsPath, 0, 1024);
      
      // Buscar metadados do vídeo para obter MIME type original
      const video = await this.getVideoById(videoId);
      const declaredMimeType = this.extractMimeTypeFromFilename(video.originalFileName);
      
      // Validar usando magic numbers
      const { FileValidator } = await import('../common/validators/file-validator');
      const validationResult = FileValidator.extractFileInfo(fileBuffer, declaredMimeType);
      
      if (!validationResult.isValid) {
        throw new VideoProcessingException(
          `Invalid file format. Expected ${declaredMimeType}, but file appears to be ${validationResult.detectedFormat || 'unknown format'}`,
          videoId
        );
      }
      
      if (validationResult.confidence < 0.8) {
        this.logger.warn(
          `Low confidence validation for video ${videoId}. Declared: ${declaredMimeType}, Detected: ${validationResult.detectedFormat}`
        );
      }
      
      this.logger.log(`File validation successful for video ${videoId}`);
      
    } catch (error) {
      this.logger.error(`File validation failed for video ${videoId}:`, error);
      throw error;
    }
  }

  private extractMimeTypeFromFilename(filename: string): string {
    const extension = filename.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      'mp4': 'video/mp4',
      'webm': 'video/webm', 
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo',
      'mkv': 'video/x-matroska',
    };
    return extension ? mimeTypes[extension] || 'video/mp4' : 'video/mp4';
  }

  async queueVideoForProcessing(
    videoId: string,
    objectName: string,
  ): Promise<void> {
    try {
      const video = await this.getVideoById(videoId);

      await this.pubsubService.publishVideoProcessing(
        videoId,
        objectName,
        video.originalFileName,
        'video/mp4',
        0,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue video ${videoId} for processing:`,
        error,
      );
      throw error;
    }
  }

  async deleteVideo(id: string): Promise<void> {
    try {
      const video = await this.getVideoById(id);

      await this.gcsService.deleteVideoFolder(id);

      const db = this.firebaseService.getFirestore();
      await db.collection(this.collection).doc(id).delete();
    } catch (error) {
      this.logger.error(`Failed to delete video ${id}:`, error);
      throw error;
    }
  }
}
