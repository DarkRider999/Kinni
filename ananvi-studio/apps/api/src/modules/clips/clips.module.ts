import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clip } from './entities/clip.entity';
import { Caption } from './entities/caption.entity';
import { ClipsService } from './clips.service';
import { ClipsController } from './clips.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Clip, Caption])],
  controllers: [ClipsController],
  providers: [ClipsService],
  exports: [ClipsService],
})
export class ClipsModule {}
