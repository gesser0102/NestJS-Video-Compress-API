import {
  IsString,
  IsNotEmpty,
  IsIn,
  MaxLength,
  Matches,
} from 'class-validator';
import { Trim, Sanitize } from '../../common/decorators/sanitize.decorator';

export class UploadUrlRequestDto {
  @IsString()
  @IsNotEmpty()
  @Trim()
  @Sanitize()
  @MaxLength(255, { message: 'File name cannot exceed 255 characters' })
  @Matches(/^.+\.(mp4|webm|mov|avi|mkv|flv|3gp|m4v|wmv|mpg|mpeg)$/i, {
    message:
      'File name must have a valid video extension (.mp4, .webm, .mov, .avi, .mkv, .flv, .3gp, .m4v, .wmv, .mpg, .mpeg)',
  })
  fileName: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(
    [
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska',
      'video/x-flv',
      'video/3gpp',
      'video/x-m4v',
      'video/x-ms-wmv',
      'video/mpeg',
    ],
    {
      message:
        'Content type must be one of: video/mp4, video/webm, video/quicktime, video/x-msvideo, video/x-matroska, video/x-flv, video/3gpp, video/x-m4v, video/x-ms-wmv, video/mpeg',
    },
  )
  contentType: string;
}
