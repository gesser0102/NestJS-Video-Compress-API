import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  ValidationPipe,
  NotFoundException,
} from '@nestjs/common';
import { VideosService } from './videos.service';
import { GcsService } from '../gcs/gcs.service';
import { UploadUrlRequestDto } from './dto/upload-url-request.dto';
import { UploadUrlResponseDto } from './dto/upload-url-response.dto';
import { VideoListResponseDto } from './dto/video-list-response.dto';
import { VideoProcessing } from '../common/interfaces/video-processing.interface';

@Controller('api/videos')
export class VideosController {
  constructor(
    private readonly videosService: VideosService,
    private readonly gcsService: GcsService,
  ) {}

  @Post('upload-url')
  async generateUploadUrl(
    @Body(ValidationPipe) dto: UploadUrlRequestDto,
  ): Promise<UploadUrlResponseDto> {
    return this.videosService.generateUploadUrl(dto);
  }

  @Post(':id/upload-complete')
  async notifyUploadComplete(
    @Param('id') videoId: string,
  ): Promise<{ success: boolean }> {
    const video = await this.videosService.getVideoById(videoId);
    
    try {
      await this.videosService.validateUploadedFile(videoId, video.originalGcsPath);
    } catch (error) {
      await this.videosService.updateVideoProgress(videoId, 'failed', 0, error.message);
      throw error;
    }
    
    await this.videosService.queueVideoForProcessing(
      videoId,
      video.originalGcsPath,
    );
    return { success: true };
  }

  @Get()
  async getVideos(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: string,
    @Query('search') search?: string,
  ): Promise<VideoListResponseDto> {
    return this.videosService.getVideos(
      parseInt(page, 10),
      parseInt(limit, 10),
      status,
      search,
    );
  }

  @Get(':id')
  async getVideoById(@Param('id') id: string): Promise<VideoProcessing> {
    return this.videosService.getVideoById(id);
  }

  @Get(':id/download')
  async downloadVideo(
    @Param('id') videoId: string,
    @Query('quality') quality: 'original' | 'low' = 'low',
  ): Promise<{ downloadUrl: string }> {
    const video = await this.videosService.getVideoById(videoId);

    let gcsPath: string;

    if (quality === 'original') {
      gcsPath = video.originalGcsPath;
    } else {
      if (!video.lowResGcsPath) {
        throw new NotFoundException('Low resolution video not available');
      }
      gcsPath = video.lowResGcsPath;
    }

    const downloadUrl = await this.gcsService.generateDownloadUrl(gcsPath);
    return { downloadUrl };
  }

  @Get(':id/view')
  async viewVideo(
    @Param('id') videoId: string,
    @Query('quality') quality: 'original' | 'low' = 'low',
  ): Promise<{ viewUrl: string }> {
    const video = await this.videosService.getVideoById(videoId);

    let gcsPath: string;

    if (quality === 'original') {
      gcsPath = video.originalGcsPath;
    } else {
      if (!video.lowResGcsPath) {
        throw new NotFoundException('Low resolution video not available');
      }
      gcsPath = video.lowResGcsPath;
    }

    const viewUrl = await this.gcsService.generateViewUrl(gcsPath);
    return { viewUrl };
  }

  @Get(':id/thumbnail')
  async getThumbnail(
    @Param('id') videoId: string,
  ): Promise<{ thumbnailUrl: string }> {
    const video = await this.videosService.getVideoById(videoId);

    if (!video.thumbnailGcsPath) {
      throw new NotFoundException('Thumbnail not available');
    }

    const thumbnailUrl = await this.gcsService.generateDownloadUrl(
      video.thumbnailGcsPath,
      false,
    );
    return { thumbnailUrl };
  }

  @Delete(':id')
  async deleteVideo(
    @Param('id') videoId: string,
  ): Promise<{ success: boolean }> {
    await this.videosService.deleteVideo(videoId);
    return { success: true };
  }
}
