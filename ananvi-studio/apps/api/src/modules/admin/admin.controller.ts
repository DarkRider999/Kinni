import {
  Controller, Get, Post, Patch, Body, Query, Param,
  ParseUUIDPipe, ParseIntPipe, DefaultValuePipe, UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@ananvi/shared';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  async getStats() {
    const stats = await this.admin.getStats();
    return { success: true, data: stats };
  }

  // ── Users ────────────────────────────────────────────
  @Get('users')
  async listUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) perPage: number,
    @Query('search') search?: string,
  ) {
    const { users, total } = await this.admin.listUsers(page, perPage, search);
    const safeUsers = users.map(u => {
      const { password_hash, totp_secret, reset_token, reset_token_expires, roles, credit_balance, ...safe } = u as any;
      const roleNames: string[] = (roles ?? []).map((r: any) => r.name ?? r);
      return {
        ...safe,
        role: roleNames[0] ?? 'user',
        roles: roleNames,
        credit_balance: credit_balance ?? 0,
      };
    });
    return {
      success: true, data: safeUsers,
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) },
    };
  }

  @Post('users')
  @Roles(UserRole.SUPER_ADMIN)
  async createUser(@Body() dto: CreateUserDto) {
    const user = await this.admin.createUser(dto);
    return { success: true, data: { id: user.id, email: user.email } };
  }

  @Patch('users/:id/roles')
  @Roles(UserRole.SUPER_ADMIN)
  async updateRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    await this.admin.updateUserRoles(id, dto.roles);
    return { success: true, message: 'Roles updated' };
  }

  @Patch('users/:id/toggle-active')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async toggleActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('is_active') isActive: boolean,
  ) {
    await this.admin.toggleUserActive(id, isActive);
    return { success: true, message: isActive ? 'User enabled' : 'User disabled' };
  }

  @Post('users/:id/credits')
  @Roles(UserRole.SUPER_ADMIN)
  async adjustCredits(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('amount', ParseIntPipe) amount: number,
  ) {
    await this.admin.adjustCredits(id, amount);
    return { success: true, message: `Credits adjusted by ${amount}` };
  }

  // ── Audit ────────────────────────────────────────────
  @Get('audit')
  async getAuditLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('per_page', new DefaultValuePipe(50), ParseIntPipe) perPage: number,
    @Query('user_id') userId?: string,
    @Query('action') action?: string,
  ) {
    const { logs, total } = await this.admin.getAuditLogs(page, perPage, { userId, action });
    return {
      success: true, data: logs,
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) },
    };
  }

  // ── Settings ─────────────────────────────────────────
  @Get('settings')
  @Roles(UserRole.SUPER_ADMIN)
  async getSettings() {
    const settings = await this.admin.getSettings();
    return { success: true, data: settings };
  }

  @Patch('settings')
  @Roles(UserRole.SUPER_ADMIN)
  async updateSetting(@Body() body: { key: string; value: string }) {
    const setting = await this.admin.updateSetting(body.key, body.value);
    return { success: true, data: setting };
  }

  // ── Jobs (admin view) ────────────────────────────────
  @Get('jobs')
  async getAllJobs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) perPage: number,
    @Query('status') status?: string,
  ) {
    const { jobs, total } = await this.admin.getAllJobs(page, perPage, status);
    const mapped = jobs.map(j => ({
      id: j.id,
      user_email: (j as any).user?.email ?? '',
      status: j.status,
      caption_style: j.caption_style,
      clips_count: j.clip_count,
      credits_used: j.credits_charged,
      created_at: j.created_at,
      error_message: j.error_message ?? null,
    }));
    return {
      success: true, data: mapped,
      meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) },
    };
  }
}
