import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Job } from './entities/job.entity';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { VideoProcessor } from './processors/video.processor';
import { ClipsModule } from '../clips/clips.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Job]),
    BullModule.registerQueue({ name: 'video-processing' }),
    ClipsModule,
    BillingModule,
  ],
  controllers: [JobsController],
  providers: [JobsService, VideoProcessor],
  exports: [JobsService],
})
export class JobsModule {}
