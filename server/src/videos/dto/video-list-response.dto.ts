import { VideoProcessing } from '../../common/interfaces/video-processing.interface';

export class VideoListResponseDto {
  items: VideoProcessing[];
  page: number;
  limit: number;
  total: number;
}
