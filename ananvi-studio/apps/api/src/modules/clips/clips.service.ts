import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clip } from './entities/clip.entity';
import { Caption } from './entities/caption.entity';
import { McpService } from '../mcp/mcp.service';

@Injectable()
export class ClipsService {
  constructor(
    @InjectRepository(Clip) private readonly clipRepo: Repository<Clip>,
    @InjectRepository(Caption) private readonly captionRepo: Repository<Caption>,
    private readonly mcp: McpService,
  ) {}

  async create(data: {
    job_id: string; user_id: string; title: string;
    start_time: number; end_time: number; duration: number;
    hook_score: number; flow_score: number; value_score: number;
    video_s3_key: string; thumbnail_s3_key: string;
    captions?: Partial<Caption>[];
  }): Promise<Clip> {
    const overall = (data.hook_score + data.flow_score + data.value_score) / 3;
    const clip = this.clipRepo.create({ ...data, overall_score: overall });
    return this.clipRepo.save(clip);
  }

  async findByJob(jobId: string, userId: string): Promise<Clip[]> {
    const clips = await this.clipRepo.find({
      where: { job_id: jobId, user_id: userId },
      relations: ['captions'],
      order: { overall_score: 'DESC' },
    });

    // Attach pre-signed URLs
    return Promise.all(clips.map(async c => {
      (c as any).video_url = await this.mcp.getPresignedUrl(c.video_s3_key);
      (c as any).thumbnail_url = c.thumbnail_s3_key
        ? await this.mcp.getPresignedUrl(c.thumbnail_s3_key)
        : null;
      return c;
    }));
  }

  async findByUser(userId: string, page = 1, perPage = 20) {
    const [clips, total] = await this.clipRepo.findAndCount({
      where: { user_id: userId },
      relations: ['captions'],
      order: { created_at: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    const withUrls = await Promise.all(clips.map(async c => {
      (c as any).video_url = await this.mcp.getPresignedUrl(c.video_s3_key);
      (c as any).thumbnail_url = c.thumbnail_s3_key
        ? await this.mcp.getPresignedUrl(c.thumbnail_s3_key)
        : null;
      return c;
    }));

    return { clips: withUrls, total };
  }

  async findOne(id: string, userId: string): Promise<Clip> {
    const clip = await this.clipRepo.findOne({
      where: { id, user_id: userId },
      relations: ['captions'],
    });
    if (!clip) throw new NotFoundException('Clip not found');

    (clip as any).video_url = await this.mcp.getPresignedUrl(clip.video_s3_key);
    (clip as any).thumbnail_url = clip.thumbnail_s3_key
      ? await this.mcp.getPresignedUrl(clip.thumbnail_s3_key)
      : null;

    return clip;
  }

  async toggleFavorite(id: string, userId: string): Promise<Clip> {
    const clip = await this.findOne(id, userId);
    clip.is_favorite = !clip.is_favorite;
    return this.clipRepo.save(clip);
  }

  async updateTitle(id: string, userId: string, title: string): Promise<Clip> {
    const clip = await this.findOne(id, userId);
    clip.title = title;
    return this.clipRepo.save(clip);
  }

  async incrementExport(id: string): Promise<void> {
    await this.clipRepo.increment({ id }, 'export_count', 1);
  }

  async getExportUrl(id: string, userId: string): Promise<string> {
    const clip = await this.findOne(id, userId);
    await this.incrementExport(id);
    return this.mcp.getPresignedUrl(clip.video_s3_key, 3600);
  }

  async delete(id: string, userId: string): Promise<void> {
    const clip = await this.findOne(id, userId);
    await this.mcp.deleteObject(clip.video_s3_key);
    if (clip.thumbnail_s3_key) await this.mcp.deleteObject(clip.thumbnail_s3_key);
    await this.clipRepo.remove(clip);
  }
}
