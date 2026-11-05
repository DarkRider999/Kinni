import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { UserRole } from '@ananvi/shared';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
  ) {}

  async create(data: {
    email: string; username: string; password_hash: string; roles: UserRole[];
  }): Promise<User> {
    const roleEntities = await Promise.all(
      data.roles.map(r => this.roleRepo.findOneByOrFail({ name: r })),
    );

    const user = this.userRepo.create({
      email: data.email,
      username: data.username,
      password_hash: data.password_hash,
      roles: roleEntities,
    });

    return this.userRepo.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id }, relations: ['roles'] });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email }, relations: ['roles'] });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { username }, relations: ['roles'] });
  }

  async getUserRoles(userId: string): Promise<UserRole[]> {
    const user = await this.userRepo.findOne({
      where: { id: userId }, relations: ['roles'],
    });
    return user?.roles.map(r => r.name) ?? [];
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userRepo.update(id, { last_login_at: new Date() });
  }

  async updateNotificationPrefs(
    id: string,
    prefs: Partial<Record<'job_complete' | 'job_failed' | 'credit_low' | 'marketing', boolean>>,
  ): Promise<Record<string, boolean>> {
    const user = await this.findByIdOrFail(id);
    const merged = { ...(user.notification_prefs ?? {}), ...prefs };
    await this.userRepo.update(id, { notification_prefs: merged as any });
    return merged;
  }

  async updateProfile(id: string, data: Partial<Pick<User,
    'display_name' | 'avatar_url'
  >>): Promise<User> {
    await this.userRepo.update(id, data);
    return this.findByIdOrFail(id);
  }

  async updatePassword(id: string, password_hash: string): Promise<void> {
    await this.userRepo.update(id, { password_hash });
  }

  async setResetToken(id: string, token: string, expires: Date): Promise<void> {
    await this.userRepo.update(id, {
      reset_token: token,
      reset_token_expires: expires,
    });
  }

  async findByResetToken(token: string): Promise<User | null> {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .where('u.reset_token = :token', { token })
      .andWhere('u.reset_token_expires > NOW()')
      .getOne();
    return user;
  }

  async clearResetToken(id: string): Promise<void> {
    await this.userRepo.update(id, {
      reset_token: null,
      reset_token_expires: null,
    });
  }

  async setTotpSecret(id: string, secret: string): Promise<void> {
    await this.userRepo.update(id, { totp_secret: secret });
  }

  async enableTotp(id: string): Promise<void> {
    await this.userRepo.update(id, { totp_enabled: true });
  }

  async disableTotp(id: string): Promise<void> {
    await this.userRepo.update(id, { totp_enabled: false, totp_secret: null });
  }

  async findAll(page = 1, perPage = 20): Promise<{ users: User[]; total: number }> {
    const [users, total] = await this.userRepo.findAndCount({
      relations: ['roles'],
      order: { created_at: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
    return { users, total };
  }

  async toggleActive(id: string, is_active: boolean): Promise<void> {
    await this.userRepo.update(id, { is_active });
  }

  async setRoles(id: string, roleNames: UserRole[]): Promise<void> {
    const user = await this.findByIdOrFail(id);
    const roles = await Promise.all(
      roleNames.map(r => this.roleRepo.findOneByOrFail({ name: r })),
    );
    user.roles = roles;
    await this.userRepo.save(user);
  }

  private async findByIdOrFail(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
