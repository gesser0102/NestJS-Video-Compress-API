import { Storage } from '@google-cloud/storage';
import { config } from '../config';
import * as fs from 'fs';
import * as path from 'path';

export class GcsService {
  private storage!: Storage;
  private bucket: any;

  constructor() {
    try {
      this.storage = new Storage({
        projectId: config.gcpProjectId,
        credentials: {
          client_email: config.firebase.clientEmail,
          private_key: config.firebase.privateKey.replace(/\\n/g, '\n'),
        },
      });
      this.bucket = this.storage.bucket(config.gcsBucket);
      console.log('✅ GCS Service initialized with Firebase credentials');
    } catch (error) {
      console.error('❌ Failed to initialize GCS Service:', error);
    }
  }

  async downloadFile(objectName: string, localPath: string): Promise<void> {
    const file = this.bucket.file(objectName);
    
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await file.download({ destination: localPath });
  }

  async uploadFile(localPath: string, objectName: string): Promise<void> {
    await this.bucket.upload(localPath, {
      destination: objectName,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });
  }

  async fileExists(objectName: string): Promise<boolean> {
    try {
      const [exists] = await this.bucket.file(objectName).exists();
      return exists;
    } catch (error) {
      return false;
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
}