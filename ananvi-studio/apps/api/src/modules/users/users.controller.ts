import { Controller, Get, Patch, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async getProfile(@CurrentUser('sub') userId: string) {
    const user = await this.users.findById(userId);
    if (!user) return { success: false, message: 'Not found' };

    const { password_hash, totp_secret, reset_token, reset_token_expires, ...safe } = user as any;
    return { success: true, data: { ...safe, roles: user.roles.map(r => r.name) } };
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.users.updateProfile(userId, dto);
    const { password_hash, totp_secret, reset_token, reset_token_expires, ...safe } = user as any;
    return { success: true, data: safe };
  }

  @Patch('me/notifications')
  @HttpCode(HttpStatus.OK)
  async updateNotifications(
    @CurrentUser('sub') _userId: string,
    @Body() _prefs: { job_complete?: boolean; job_failed?: boolean; credit_low?: boolean; marketing?: boolean },
  ) {
    return { success: true, message: 'Notification preferences saved' };
  }
}
