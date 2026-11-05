import {
  Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const tokens = await this.auth.register(dto.email, dto.username, dto.password);
    return { success: true, data: tokens };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const tokens = await this.auth.login(dto.email, dto.password, dto.totp_code);
    return { success: true, data: tokens };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    const tokens = await this.auth.refresh(dto.refresh_token);
    return { success: true, data: tokens };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body('email') email: string) {
    const result = await this.auth.requestPasswordReset(email);
    return { success: true, data: result };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.password);
    return { success: true, message: 'Password reset successfully' };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('sub') userId: string,
    @Body('current_password') currentPassword: string,
    @Body('new_password') newPassword: string,
  ) {
    await this.auth.changePassword(userId, currentPassword, newPassword);
    return { success: true, message: 'Password changed successfully' };
  }

  @Post('2fa/setup')
  async setup2FA(@CurrentUser('sub') userId: string) {
    const { secret, qrUri } = await this.auth.setup2FA(userId);
    return { success: true, data: { secret, qr_url: qrUri } };
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  async verify2FA(
    @CurrentUser('sub') userId: string,
    @Body('code') code: string,
  ) {
    await this.auth.verify2FA(userId, code);
    return { success: true, message: '2FA enabled' };
  }

  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  async enable2FA(
    @CurrentUser('sub') userId: string,
    @Body('code') code: string,
  ) {
    await this.auth.verify2FA(userId, code);
    return { success: true, message: '2FA enabled' };
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  async disable2FA(
    @CurrentUser('sub') userId: string,
    @Body('password') password: string,
  ) {
    await this.auth.disable2FA(userId, password);
    return { success: true, message: '2FA disabled' };
  }
}
