import { Module } from '@nestjs/common';
import { GcsService } from './gcs.service';
import { AppConfigService } from '../config/config.service';

@Module({
  providers: [GcsService, AppConfigService],
  exports: [GcsService],
})
export class GcsModule {}
