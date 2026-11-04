import {
  Controller, Get, Post, Patch, Body, Param, Query,
  ParseUUIDPipe, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateJobDto } from './dto/create-job.dto';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get('stats')
  async getStats(@CurrentUser('sub') userId: string) {
    const stats = await this.jobs.getStats(userId);
    return { success: true, data: stats };
  }

  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateJobDto,
  ) {
    const job = await this.jobs.create(userId, dto);
    return { success: true, data: job };
  }

  @Get()
  async listMine(
    @CurrentUser('sub') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('per_page', new DefaultValuePipe(20), ParseIntPipe) perPage: number,
  ) {
    const { jobs, total } = await this.jobs.findByUser(userId, page, perPage);
    return {
      success: true,
      data: jobs,
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) },
    };
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    const job = await this.jobs.findById(id, userId);
    return { success: true, data: job };
  }

  @Patch(':id/cancel')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    const job = await this.jobs.cancel(id, userId);
    return { success: true, data: job };
  }
}
