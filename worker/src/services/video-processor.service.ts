import ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs';
import { GcsService } from './gcs.service';
import { NotificationPublisherService } from './notification-publisher.service';
import { config } from '../config';

ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
ffmpeg.setFfprobePath('/usr/bin/ffprobe');

export interface ProcessingResult {
  lowResPath: string;
  thumbnailPath: string;
  metadata: {
    sizeBytes: number;
    lowResSizeBytes: number;
    originalResolution: string;
    lowResolution: string;
    durationSeconds: number;
  };
}

export class VideoProcessorService {
  private notificationService: NotificationPublisherService;

  constructor(
    private gcsService: GcsService,
  ) {
    this.notificationService = new NotificationPublisherService();
  }

  async processVideo(videoId: string, originalGcsPath: string): Promise<ProcessingResult> {
    const workDir = path.join(__dirname, '../../temp', videoId);
    
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }

    try {
      await this.notificationService.notifyProcessingStart(videoId);

      const originalExt = path.extname(originalGcsPath);
      const baseName = path.basename(originalGcsPath, originalExt);
      
      const originalLocalPath = path.join(workDir, `original${originalExt}`);
      const lowResLocalPath = path.join(workDir, `low${originalExt}`);
      const thumbnailLocalPath = path.join(workDir, 'thumbnail.webp');

      console.log(`Downloading original video: ${originalGcsPath}`);
      await this.gcsService.downloadFile(originalGcsPath, originalLocalPath);
      await this.notificationService.notifyProcessingProgress(videoId, 20);

      console.log(`Getting video metadata for ${videoId}`);
      const metadata = await this.getVideoMetadata(originalLocalPath);
      await this.notificationService.notifyProcessingProgress(videoId, 30);

      console.log(`Starting parallel processing for ${videoId}`);
      
      const thumbnailPromise = this.generateThumbnail(originalLocalPath, thumbnailLocalPath, metadata.durationSeconds);
      
      console.log(`Generating low resolution video for ${videoId}`);
      await this.generateLowResolution(originalLocalPath, lowResLocalPath, videoId);
      await this.notificationService.notifyProcessingProgress(videoId, 70);

      console.log(`Waiting for thumbnail completion for ${videoId}`);
      await thumbnailPromise;
      await this.notificationService.notifyProcessingProgress(videoId, 85);

      const originalFileName = path.basename(originalGcsPath);
      const fileNameWithoutExt = originalFileName.replace(originalExt, '');
      const videoFolder = path.dirname(originalGcsPath);
      
      const lowResGcsPath = `${videoFolder}/${fileNameWithoutExt}_low${originalExt}`;
      const thumbnailGcsPath = `${videoFolder}/${fileNameWithoutExt}_thumb.webp`;

      console.log(`Uploading processed files for ${videoId}`);
      await Promise.all([
        this.gcsService.uploadFile(lowResLocalPath, lowResGcsPath),
        this.gcsService.uploadFile(thumbnailLocalPath, thumbnailGcsPath),
      ]);
      await this.notificationService.notifyProcessingProgress(videoId, 95);

      const originalStats = fs.statSync(originalLocalPath);
      const lowResStats = fs.statSync(lowResLocalPath);
      const processedMetadata = await this.getVideoMetadata(lowResLocalPath);
      
      const result: ProcessingResult = {
        lowResPath: lowResGcsPath,
        thumbnailPath: thumbnailGcsPath,
        metadata: {
          sizeBytes: originalStats.size,
          lowResSizeBytes: lowResStats.size,
          originalResolution: `${metadata.width}x${metadata.height}`,
          lowResolution: `${processedMetadata.width}x${processedMetadata.height}`,
          durationSeconds: metadata.durationSeconds,
        },
      };

      await this.notificationService.notifyProcessingCompleteWithMetadata(
        videoId,
        lowResGcsPath,
        thumbnailGcsPath,
        result.metadata
      );
      console.log(`Processing completed for video ${videoId}`);

      return result;
    } finally {
      this.cleanup(workDir);
    }
  }

  private async getVideoMetadata(filePath: string): Promise<{
    width: number;
    height: number;
    durationSeconds: number;
  }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find((stream: any) => stream.codec_type === 'video');
        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        resolve({
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          durationSeconds: parseFloat(metadata.format.duration?.toString() || '0'),
        });
      });
    });
  }

  private async generateLowResolution(inputPath: string, outputPath: string, videoId: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const metadata = await this.getVideoMetadata(inputPath);
        const originalWidth = metadata.width;
        const originalHeight = metadata.height;
        
        let targetBitrate: number;
        let lowQualityCrf: number;
        
        if (originalHeight >= 1080) {
          targetBitrate = 1000;
          lowQualityCrf = 28;
        } else if (originalHeight >= 720) {
          targetBitrate = 600;
          lowQualityCrf = 27;
        } else if (originalHeight >= 480) {
          targetBitrate = 400;
          lowQualityCrf = 26;
        } else {
          targetBitrate = 250;
          lowQualityCrf = 25;
        }
        
        targetBitrate = Math.min(targetBitrate, config.ffmpeg.maxBitrate);
        
        ffmpeg(inputPath)
          .videoCodec('libx264')
          .videoBitrate(`${targetBitrate}k`)
          .audioBitrate('64k')
          .audioCodec('aac')
          .outputOptions([
            `-crf ${lowQualityCrf}`,
            '-movflags +faststart',
            '-tune film',
            `-threads ${config.ffmpeg.threads}`,
            `-preset ${config.ffmpeg.preset}`,
            '-profile:v high',
            '-level 4.1',
            '-pix_fmt yuv420p',
            '-avoid_negative_ts make_zero',
            '-fflags +genpts',
            '-x264opts keyint=240:min-keyint=120:ref=1:bframes=2:me=hex:subme=4:trellis=0:weightb=0:mixed-refs=0:8x8dct=0:fast-pskip=1',
            '-maxrate', `${Math.round(targetBitrate * 1.1)}k`,
            '-bufsize', `${Math.round(targetBitrate * 1.2)}k`,
            '-g 240',
            '-bf 2',
            '-qmin 18',
            '-qmax 40',
            '-qdiff 15',
            '-flags -cgop',
            '-sc_threshold 0',
          ])
          .on('progress', (progress: any) => {
            const percent = Math.min(100, Math.max(0, progress.percent || 0));
            const adjustedPercent = 30 + (percent * 0.4);
            
            this.notificationService.notifyProcessingProgress(videoId, Math.round(adjustedPercent)).catch(console.error);
          })
          .on('end', () => {
            resolve();
          })
          .on('error', (err: any) => {
            reject(err);
          })
          .save(outputPath);
      } catch (error) {
        reject(error);
      }
    });
  }

  private async generateThumbnail(inputPath: string, outputPath: string, durationSeconds: number): Promise<void> {
    const thumbnailTime = Math.min(5, durationSeconds * 0.1);
    
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: [thumbnailTime.toString()],
          filename: 'thumbnail.webp',
          folder: path.dirname(outputPath),
          size: '320x180',
        })
        .on('end', () => {
          resolve();
        })
        .on('error', (err: any) => {
          reject(err);
        });
    });
  }

  private cleanup(workDir: string): void {
    try {
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error(`Failed to cleanup work directory ${workDir}:`, error);
    }
  }
}