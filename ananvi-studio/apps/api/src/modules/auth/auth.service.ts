import {
  Injectable, UnauthorizedException, ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import { UsersService } from '../users/users.service';
import { ITokenPair, IJwtPayload, UserRole } from '@ananvi/shared';

@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 12;
  private readonly REFRESH_SECRET: string;
  private readonly REFRESH_EXPIRY = '7d';

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.REFRESH_SECRET = this.config.getOrThrow('JWT_REFRESH_SECRET');
  }

  // ── Register ─────────────────────────────────────────
  async register(email: string, username: string, password: string): Promise<ITokenPair> {
    const existing = await this.users.findByEmail(email);
    if (existing) throw new ConflictException('Email already registered');

    const existingUsername = await this.users.findByUsername(username);
    if (existingUsername) throw new ConflictException('Username already taken');

    const password_hash = await bcrypt.hash(password, this.SALT_ROUNDS);

    const user = await this.users.create({
      email: email.toLowerCase().trim(),
      username: username.toLowerCase().trim(),
      password_hash,
      roles: [UserRole.USER],
    });

    return this.generateTokenPair(user.id, user.email, [UserRole.USER]);
  }

  // ── Login ────────────────────────────────────────────
  async login(email: string, password: string, totpCode?: string): Promise<ITokenPair> {
    const user = await this.users.findByEmail(email.toLowerCase().trim());
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    // TOTP check
    if (user.totp_enabled) {
      if (!totpCode) {
        throw new BadRequestException('2FA code required');
      }
      const isValid = authenticator.verify({
        token: totpCode,
        secret: user.totp_secret!,
      });
      if (!isValid) throw new UnauthorizedException('Invalid 2FA code');
    }

    await this.users.updateLastLogin(user.id);
    const roles = await this.users.getUserRoles(user.id);

    return this.generateTokenPair(user.id, user.email, roles);
  }

  // ── Refresh ──────────────────────────────────────────
  async refresh(refreshToken: string): Promise<ITokenPair> {
    try {
      const payload = this.jwt.verify<IJwtPayload>(refreshToken, {
        secret: this.REFRESH_SECRET,
      });

      const user = await this.users.findById(payload.sub);
      if (!user || !user.is_active) {
        throw new UnauthorizedException('User not found or disabled');
      }

      const roles = await this.users.getUserRoles(user.id);
      return this.generateTokenPair(user.id, user.email, roles);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // ── Password Reset ───────────────────────────────────
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.users.findByEmail(email.toLowerCase());
    if (!user) {
      // Don't leak whether email exists
      return { message: 'If that email exists, a reset link has been sent.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600_000); // 1 hour

    await this.users.setResetToken(user.id, token, expires);

    // TODO: Send email via transactional email service
    // await this.mailer.sendPasswordReset(user.email, token);

    return { message: 'If that email exists, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.users.findByResetToken(token);
    if (!user) throw new BadRequestException('Invalid or expired reset token');

    const password_hash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    await this.users.updatePassword(user.id, password_hash);
    await this.users.clearResetToken(user.id);
  }

  // ── 2FA Setup ────────────────────────────────────────
  async setup2FA(userId: string): Promise<{ secret: string; qrUri: string }> {
    const secret = authenticator.generateSecret();
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();

    const qrUri = authenticator.keyuri(user.email, 'Ananvi Studio', secret);

    // Store secret but don't enable until verified
    await this.users.setTotpSecret(userId, secret);

    return { secret, qrUri };
  }

  async verify2FA(userId: string, code: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user?.totp_secret) throw new BadRequestException('2FA not set up');

    const valid = authenticator.verify({ token: code, secret: user.totp_secret });
    if (!valid) throw new BadRequestException('Invalid code');

    await this.users.enableTotp(userId);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const password_hash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    await this.users.updatePassword(userId, password_hash);
  }

  async disable2FA(userId: string, password: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid password');

    await this.users.disableTotp(userId);
  }

  // ── Token Generation ─────────────────────────────────
  private generateTokenPair(
    userId: string, email: string, roles: UserRole[],
  ): ITokenPair {
    const payload: Omit<IJwtPayload, 'iat' | 'exp'> = {
      sub: userId,
      email,
      roles,
    };

    const access_token = this.jwt.sign(payload);

    const refresh_token = this.jwt.sign(payload, {
      secret: this.REFRESH_SECRET,
      algorithm: 'HS256',
      expiresIn: this.REFRESH_EXPIRY,
    });

    return {
      access_token,
      refresh_token,
      expires_in: 900, // 15 min in seconds
    };
  }
}
