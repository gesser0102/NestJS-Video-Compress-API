import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { AppConfigService } from '../config/config.service';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private db: admin.firestore.Firestore;

  constructor(private configService: AppConfigService) {}

  onModuleInit() {
    if (!admin.apps.length) {
      // For development, initialize with mock credentials if real ones aren't available
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: this.configService.firebaseProjectId,
            clientEmail: this.configService.firebaseClientEmail,
            privateKey: this.configService.firebasePrivateKey.replace(
              /\\n/g,
              '\n',
            ),
          }),
        });
      } catch (error) {
        console.warn(
          'Failed to initialize Firebase with provided credentials, using mock mode for development',
        );
        // Initialize with minimal mock for development
        admin.initializeApp({
          projectId: this.configService.firebaseProjectId || 'mock-project',
        });
      }
    }
    this.db = admin.firestore();
  }

  getFirestore(): admin.firestore.Firestore {
    return this.db;
  }
}
