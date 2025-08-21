import { Injectable, Logger } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { AppConfigService } from '../config/config.service';
import {
  StorageException,
  ConfigurationException,
} from '../common/exceptions/custom.exceptions';
import { v4 as uuidv4 } from 'uuid';
import { FilenameSanitizer } from '../common/utils/filename-sanitizer';

@Injectable()
export class GcsService {
  private readonly logger = new Logger(GcsService.name);
  private storage: Storage;
  private bucket: any;

  constructor(private configService: AppConfigService) {
    try {
      this.validateConfiguration();

      this.storage = new Storage({
        projectId: this.configService.gcpProjectId,
        credentials: {
          client_email: this.configService.firebaseClientEmail,
          private_key: this.configService.firebasePrivateKey.replace(
            /\\n/g,
            '\n',
          ),
        },
      });
      this.bucket = this.storage.bucket(this.configService.gcsBucket);
      this.logger.log('GCS Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize GCS Service:', error.stack);
      throw error;
    }
  }

  private validateConfiguration(): void {
    const requiredConfigs = [
      { key: 'gcpProjectId', value: this.configService.gcpProjectId },
      { key: 'gcsBucket', value: this.configService.gcsBucket },
      {
        key: 'firebaseClientEmail',
        value: this.configService.firebaseClientEmail,
      },
      {
        key: 'firebasePrivateKey',
        value: this.configService.firebasePrivateKey,
      },
    ];

    for (const config of requiredConfigs) {
      if (!config.value) {
        throw new ConfigurationException(
          config.key,
          `${config.key} is required for GCS service`,
        );
      }
    }
  }

  async generateSignedUrl(
    fileName: string,
    contentType: string,
    videoId?: string,
  ): Promise<{
    signedUrl: string;
    objectName: string;
    bucket: string;
    expiresAt: Date;
  }> {
    const id = videoId || uuidv4();
    // Sanitize filename to prevent path traversal attacks
    const objectName = FilenameSanitizer.generateSafeObjectName(id, fileName);
    const file = this.bucket.file(objectName);

    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() + this.configService.signUrlExpirationSeconds,
    );

    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: expiresAt,
      contentType,
    });

    return {
      signedUrl,
      objectName,
      bucket: this.configService.gcsBucket,
      expiresAt,
    };
  }

  async fileExists(objectName: string): Promise<boolean> {
    try {
      this.logger.log(`Checking if file exists: ${objectName}`);
      const [exists] = await this.bucket.file(objectName).exists();
      this.logger.log(`File ${objectName} exists: ${exists}`);
      return exists;
    } catch (error) {
      this.logger.error(
        `Error checking if file exists ${objectName}:`,
        error.stack,
      );
      throw new StorageException(
        `Failed to check if file exists: ${error.message}`,
        'fileExists',
      );
    }
  }

  async getFileMetadata(objectName: string): Promise<any> {
    try {
      const [metadata] = await this.bucket.file(objectName).getMetadata();
      return metadata;
    } catch (error) {
      return null;
    }
  }

  async generateDownloadUrl(
    objectName: string,
    forceDownload: boolean = true,
  ): Promise<string> {
    const signedUrlConfig: any = {
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000,
    };

    if (forceDownload) {
      const filename = objectName.split('/').pop() || 'download';

      signedUrlConfig.responseDisposition = `attachment; filename="${filename}"`;
      signedUrlConfig.responseType = 'application/octet-stream';
    }

    const [url] = await this.bucket
      .file(objectName)
      .getSignedUrl(signedUrlConfig);
    return url;
  }

  async generateViewUrl(objectName: string): Promise<string> {
    const [url] = await this.bucket.file(objectName).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000,
    });
    return url;
  }

  async deleteVideoFolder(videoId: string): Promise<void> {
    try {
      console.log(`🗑️ Deleting video folder: videos/${videoId}/`);

      const [files] = await this.bucket.getFiles({
        prefix: `videos/${videoId}/`,
      });

      if (files.length === 0) {
        console.log(`📁 No files found in folder videos/${videoId}/`);
        return;
      }

      const deletePromises = files.map((file) => {
        console.log(`🗑️ Deleting file: ${file.name}`);
        return file.delete();
      });

      await Promise.all(deletePromises);
      console.log(
        `✅ Successfully deleted ${files.length} files from videos/${videoId}/`,
      );
    } catch (error) {
      console.error(`❌ Error deleting video folder ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Download specific bytes from a file for validation
   */
  async downloadFileBytes(objectName: string, start: number, end: number): Promise<Buffer> {
    try {
      const file = this.bucket.file(objectName);
      const [exists] = await file.exists();
      
      if (!exists) {
        throw new StorageException(`File not found: ${objectName}`);
      }

      const stream = file.createReadStream({
        start,
        end: end - 1,
      });

      const chunks: Buffer[] = [];
      
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        
        stream.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        
        stream.on('error', (error) => {
          reject(new StorageException(`Failed to download file bytes: ${error.message}`));
        });
      });
      
    } catch (error) {
      throw new StorageException(
        `Failed to download bytes from ${objectName}`,
        'downloadFileBytes',
      );
    }
  }
}
