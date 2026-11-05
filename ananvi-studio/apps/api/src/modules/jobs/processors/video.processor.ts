import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job as BullJob } from 'bullmq';
import { JobsService } from '../jobs.service';
import { ClipsService } from '../../clips/clips.service';
import { McpService } from '../../mcp/mcp.service';
import { JobStatus } from '@ananvi/shared';

interface VideoJobData {
  jobId: string;
  sourceUrl: string;
  clipCount: number;
  captionStyle: string;
  captionLanguage: string;
  aiVideoStyle: string | null;
}

@Processor('video-processing', { concurrency: 2 })
export class VideoProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessor.name);

  constructor(
    private readonly jobs: JobsService,
    private readonly clips: ClipsService,
    private readonly mcp: McpService,
  ) {
    super();
  }

  async process(job: BullJob<VideoJobData>): Promise<void> {
    const { jobId, sourceUrl, clipCount, captionStyle, captionLanguage, aiVideoStyle } = job.data;
    this.logger.log(`Processing job ${jobId}: ${sourceUrl}`);

    try {
      // Phase 1: Download source (10%)
      await this.jobs.updateProgress(jobId, 5);
      const sourcePath = await this.mcp.downloadSource(sourceUrl);
      await this.jobs.updateProgress(jobId, 10);

      // Phase 2: Analyze video for clip-worthy segments (30%)
      const segments = await this.mcp.analyzeVideo(sourcePath, clipCount);
      await this.jobs.updateProgress(jobId, 30);

      // Phase 3: Extract clips via FFmpeg (60%)
      const clipPaths: string[] = [];
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const clipPath = await this.mcp.extractClip(sourcePath, seg.start, seg.end);
        clipPaths.push(clipPath);

        const progress = 30 + Math.round((i + 1) / segments.length * 30);
        await this.jobs.updateProgress(jobId, progress);
      }

      // Phase 4: Generate captions (80%)
      const captions = await this.mcp.generateCaptions(
        clipPaths, captionLanguage, captionStyle,
      );
      await this.jobs.updateProgress(jobId, 80);

      // Phase 5: Upload to S3 + create DB records (95%)
      for (let i = 0; i < clipPaths.length; i++) {
        const seg = segments[i];
        const clipPath = clipPaths[i];

        const { videoKey, thumbnailKey } = await this.mcp.uploadClipAssets(
          jobId, clipPath, i,
        );

        await this.clips.create({
          job_id: jobId,
          user_id: (await this.jobs.findById(jobId)).user_id,
          title: `Clip ${i + 1}`,
          start_time: seg.start,
          end_time: seg.end,
          duration: seg.end - seg.start,
          hook_score: seg.hookScore,
          flow_score: seg.flowScore,
          value_score: seg.valueScore,
          video_s3_key: videoKey,
          thumbnail_s3_key: thumbnailKey,
          captions: captions[i],
        });

        const progress = 80 + Math.round((i + 1) / clipPaths.length * 15);
        await this.jobs.updateProgress(jobId, progress);
      }

      // Phase 6: Cleanup temp files + mark complete (100%)
      await this.mcp.cleanupTemp(sourcePath, clipPaths);
      await this.jobs.markComplete(jobId);

      this.logger.log(`Job ${jobId} completed successfully`);
    } catch (error: any) {
      this.logger.error(`Job ${jobId} failed: ${error.message}`, error.stack);
      await this.jobs.markError(jobId, error.message);
      throw error; // Let BullMQ retry
    }
  }
}
