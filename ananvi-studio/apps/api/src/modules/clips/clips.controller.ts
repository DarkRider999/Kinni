import {
  Controller, Get, Patch, Delete, Param, Query, Body,
  ParseUUIDPipe, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ClipsService } from './clips.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('clips')
export class ClipsController {
  constructor(private readonly clips: ClipsService) {}

  @Get()
  async listMine(
    @CurrentUser('sub') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('per_page', new DefaultValuePipe(20), ParseIntPipe) perPage: number,
  ) {
    const { clips, total } = await this.clips.findByUser(userId, page, perPage);
    return {
      success: true, data: clips,
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) },
    };
  }

  @Get('job/:jobId')
  async listByJob(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser('sub') userId: string,
  ) {
    const clips = await this.clips.findByJob(jobId, userId);
    return { success: true, data: clips };
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    const clip = await this.clips.findOne(id, userId);
    return { success: true, data: clip };
  }

  @Patch(':id/favorite')
  async toggleFavorite(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    const clip = await this.clips.toggleFavorite(id, userId);
    return { success: true, data: { is_favorite: clip.is_favorite } };
  }

  @Patch(':id/title')
  async updateTitle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
    @Body('title') title: string,
  ) {
    const clip = await this.clips.updateTitle(id, userId, title);
    return { success: true, data: clip };
  }

  @Get(':id/export')
  async exportClip(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    const url = await this.clips.getExportUrl(id, userId);
    return { success: true, data: { download_url: url } };
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    await this.clips.delete(id, userId);
    return { success: true, message: 'Clip deleted' };
  }
}
