import { Module } from '@nestjs/common';
import { FirebaseService } from './firebase.service';
import { AppConfigService } from '../config/config.service';

@Module({
  providers: [FirebaseService, AppConfigService],
  exports: [FirebaseService],
})
export class FirebaseModule {}
