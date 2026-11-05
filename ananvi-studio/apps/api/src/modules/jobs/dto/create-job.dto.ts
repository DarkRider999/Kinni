import {
  IsUrl, IsString, IsOptional, IsInt, Min, Max, IsEnum,
} from 'class-validator';
import { CaptionStyle, AIVideoStyle } from '@ananvi/shared';

export class CreateJobDto {
  @IsUrl()
  source_url: string;

  @IsOptional()
  @IsString()
  source_platform?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  clip_count?: number;

  @IsOptional()
  @IsEnum(CaptionStyle)
  caption_style?: CaptionStyle;

  @IsOptional()
  @IsString()
  caption_language?: string;

  @IsOptional()
  @IsEnum(AIVideoStyle)
  ai_video_style?: AIVideoStyle;
}
