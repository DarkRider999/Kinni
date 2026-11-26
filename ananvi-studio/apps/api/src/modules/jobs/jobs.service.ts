import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Job } from './entities/job.entity';
import { BillingService } from '../billing/billing.service';
import { JobStatus, CreditTransactionType, UserRole } from '@ananvi/shared';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectRepository(Job) private readonly jobRepo: Repository<Job>,
    @InjectQueue('video-processing') private readonly videoQueue: Queue,
    private readonly billing: BillingService,
  ) {}

  async create(userId: string, data: {
    source_url: string;
    source_platform?: string;
    clip_count?: number;
    caption_style?: string;
    caption_language?: string;
    ai_video_style?: string;
  }): Promise<Job> {
    // 1. Estimate duration (fetched async — placeholder for MVP)
    const estimatedMinutes = 5; // TODO: fetch actual duration via yt-dlp
    const creditsRequired = Math.ceil(estimatedMinutes);

    // 2. Check & deduct credits
    let balance: number;
    try {
      balance = await this.billing.getBalance(userId);
    } catch (err) {
      throw new BadRequestException(`Failed to fetch credit balance: ${(err as Error).message}`);
    }
    if (balance < creditsRequired) {
      throw new BadRequestException(
        `Insufficient credits. Need ${creditsRequired}, have ${balance}.`
      );
    }

    // 3. Create job record
    const job = this.jobRepo.create({
      user_id: userId,
      source_url: data.source_url,
      source_platform: data.source_platform || 'youtube',
      credits_charged: creditsRequired,
      clip_count: data.clip_count || 10,
      caption_style: (data.caption_style as any) || 'excited',
      caption_language: data.caption_language || 'en',
      ai_video_style: (data.ai_video_style as any) || null,
      status: JobStatus.QUEUED,
    });

    let saved: Job;
    try {
      saved = await this.jobRepo.save(job);
    } catch (err) {
      throw new BadRequestException(`Failed to create job record: ${(err as Error).message}`);
    }

    // 4. Deduct credits — compensate with job delete if this fails to avoid orphaned QUEUED row
    try {
      await this.billing.deductCredits(userId, creditsRequired, {
        type: CreditTransactionType.USAGE,
        description: `Job ${saved.id} — ${creditsRequired} credits`,
        reference_id: saved.id,
      });
    } catch (err) {
      await this.jobRepo.delete(saved.id).catch((e: Error) => {
        this.logger.error(`Failed to delete orphaned job ${saved.id} after deduction failure: ${e.message}`);
      });
      throw new BadRequestException(`Failed to deduct credits: ${(err as Error).message}`);
    }

    // 5. Enqueue processing — compensate on failure to avoid orphaned job + deducted credits
    try {
      await this.videoQueue.add('process-video', {
        jobId: saved.id,
        sourceUrl: data.source_url,
        clipCount: saved.clip_count,
        captionStyle: saved.caption_style,
        captionLanguage: saved.caption_language,
        aiVideoStyle: saved.ai_video_style,
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      });
    } catch (enqueueErr) {
      const rollbackErrors: string[] = [];
      await this.jobRepo.delete(saved.id).catch((e: Error) => {
        rollbackErrors.push(`job delete: ${e.message}`);
      });
      await this.billing.addCredits(userId, creditsRequired, {
        type: CreditTransactionType.REFUND,
        description: `Refund for failed enqueue of job ${saved.id}`,
        reference_id: saved.id,
      }).catch((e: Error) => {
        rollbackErrors.push(`credit refund: ${e.message}`);
      });
      if (rollbackErrors.length > 0) {
        this.logger.error(
          `Enqueue rollback partial failures for job ${saved.id}: ${rollbackErrors.join('; ')}`
        );
      }
      const refundMsg = rollbackErrors.some(e => e.startsWith('credit refund'))
        ? 'Credits may not have been refunded — please contact support.'
        : 'Credits have been refunded.';
      throw new BadRequestException(
        `Failed to enqueue job. ${refundMsg} (${(enqueueErr as Error).message})`
      );
    }

    return saved;
  }

  async findByUser(userId: string, page = 1, perPage = 20) {
    const [jobs, total] = await this.jobRepo.findAndCount({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
    return { jobs, total };
  }

  async findById(id: string, userId?: string): Promise<Job> {
    const where: any = { id };
    if (userId) where.user_id = userId;
    const job = await this.jobRepo.findOne({ where });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async cancel(id: string, userId: string): Promise<Job> {
    const job = await this.findById(id, userId);

    if (![JobStatus.QUEUED, JobStatus.PROCESSING].includes(job.status)) {
      throw new BadRequestException('Job cannot be cancelled in current state');
    }

    // Refund before persisting CANCELLED — if refund fails, job stays in current state
    if (job.credits_charged > 0) {
      try {
        await this.billing.addCredits(userId, job.credits_charged, {
          type: CreditTransactionType.REFUND,
          description: `Refund for cancelled job ${id}`,
          reference_id: id,
        });
      } catch (err) {
        throw new BadRequestException(`Failed to refund credits for cancellation: ${(err as Error).message}`);
      }
    }

    job.status = JobStatus.CANCELLED;
    try {
      return await this.jobRepo.save(job);
    } catch (saveErr) {
      // Save failed after refund already issued — deduct credits back to prevent double-refund on retry
      if (job.credits_charged > 0) {
        await this.billing.deductCredits(userId, job.credits_charged, {
          type: CreditTransactionType.USAGE,
          description: `Reverse refund for failed cancel of job ${id}`,
          reference_id: id,
        }).catch((e: Error) => {
          this.logger.error(`Failed to reverse refund for job ${id} after save failure: ${e.message}`);
        });
      }
      throw new BadRequestException(`Failed to persist cancellation: ${(saveErr as Error).message}`);
    }
  }

  async updateProgress(id: string, progress: number): Promise<void> {
    await this.jobRepo.update(id, { progress_percent: progress });
  }

  async markComplete(id: string): Promise<void> {
    await this.jobRepo.update(id, {
      status: JobStatus.COMPLETE,
      progress_percent: 100,
      completed_at: new Date(),
    });
  }

  async markError(id: string, message: string): Promise<void> {
    await this.jobRepo.update(id, {
      status: JobStatus.ERROR,
      error_message: message,
    });
  }

  async getStats(userId: string): Promise<{
    total_jobs: number;
    completed_jobs: number;
    failed_jobs: number;
    total_clips: number;
    credits_used: number;
    credits_remaining: number;
  }> {
    let total: number;
    let completed: number;
    let failed: number;
    let aggregates: { total_clips: string; credits_used: string } | undefined;
    let balance: number;

    try {
      [total, completed, failed, aggregates, balance] = await Promise.all([
        this.jobRepo.count({ where: { user_id: userId } }),
        this.jobRepo.count({ where: { user_id: userId, status: JobStatus.COMPLETE } }),
        this.jobRepo.count({ where: { user_id: userId, status: JobStatus.ERROR } }),
        this.jobRepo
          .createQueryBuilder('j')
          .select('COALESCE(SUM(j.clip_count), 0)', 'total_clips')
          .addSelect('COALESCE(SUM(j.credits_charged), 0)', 'credits_used')
          .where('j.user_id = :userId', { userId })
          .andWhere('j.status = :status', { status: JobStatus.COMPLETE })
          .getRawOne<{ total_clips: string; credits_used: string }>(),
        this.billing.getBalance(userId),
      ]);
    } catch (err) {
      throw new InternalServerErrorException(
        `Failed to fetch stats: ${(err as Error).message}`,
      );
    }

    return {
      total_jobs: total,
      completed_jobs: completed,
      failed_jobs: failed,
      total_clips: parseInt(aggregates?.total_clips ?? '0', 10),
      credits_used: parseInt(aggregates?.credits_used ?? '0', 10),
      credits_remaining: balance,
    };
  }

  // Admin: all jobs
  async findAll(page = 1, perPage = 20) {
    const [jobs, total] = await this.jobRepo.findAndCount({
      order: { created_at: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
    return { jobs, total };
  }
}
