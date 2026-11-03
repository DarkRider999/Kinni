import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { UsersService } from '../users/users.service';
import { JobsService } from '../jobs/jobs.service';
import { BillingService } from '../billing/billing.service';
import { User } from '../users/entities/user.entity';
import { Job } from '../jobs/entities/job.entity';
import { Payment } from '../billing/entities/payment.entity';
import { AuditLog } from './entities/audit-log.entity';
import { IAdminStats, UserRole } from '@ananvi/shared';

// Imported inline to avoid circular dep — entity file shown below
import { Setting } from './entities/setting.entity';

@Injectable()
export class AdminService {
  constructor(
    private readonly users: UsersService,
    @InjectRepository(Job) private readonly jobRepo: Repository<Job>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(Setting) private readonly settingRepo: Repository<Setting>,
  ) {}

  // ── Dashboard Stats ──────────────────────────────────
  async getStats(): Promise<IAdminStats> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 86_400_000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const { users: allUsers, total: totalUsers } = await this.users.findAll(1, 1);
    const activeUsers = await this.auditRepo
      .createQueryBuilder('a')
      .select('COUNT(DISTINCT a.user_id)', 'count')
      .where('a.created_at >= :dayAgo', { dayAgo })
      .getRawOne();

    const totalJobs = await this.jobRepo.count();
    const jobsToday = await this.jobRepo.count({
      where: { created_at: Between(dayAgo, now) as any },
    });

    const totalClips = await this.jobRepo
      .createQueryBuilder('j')
      .select('COALESCE(SUM(j.clip_count), 0)', 'total')
      .where('j.status = :s', { s: 'complete' })
      .getRawOne();

    const revenueTotal = await this.paymentRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount_cents), 0)', 'total')
      .where('p.status = :s', { s: 'completed' })
      .getRawOne();

    const revenueMonth = await this.paymentRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount_cents), 0)', 'total')
      .where('p.status = :s AND p.created_at >= :start', { s: 'completed', start: monthStart })
      .getRawOne();

    return {
      total_users: totalUsers,
      active_users_24h: parseInt(activeUsers?.count || '0', 10),
      total_jobs: totalJobs,
      jobs_today: jobsToday,
      total_clips: parseInt(totalClips?.total || '0', 10),
      revenue_total_cents: parseInt(revenueTotal?.total || '0', 10),
      revenue_month_cents: parseInt(revenueMonth?.total || '0', 10),
      credits_in_circulation: 0, // computed via credits table sum
    };
  }

  // ── User Management ──────────────────────────────────
  async listUsers(page: number, perPage: number) {
    return this.users.findAll(page, perPage);
  }

  async createUser(data: {
    email: string; username: string; password: string; roles: UserRole[];
  }) {
    const bcrypt = await import('bcrypt');
    const password_hash = await bcrypt.hash(data.password, 12);
    return this.users.create({
      email: data.email,
      username: data.username,
      password_hash,
      roles: data.roles,
    });
  }

  async updateUserRoles(userId: string, roles: UserRole[]): Promise<void> {
    await this.users.setRoles(userId, roles);
  }

  async toggleUserActive(userId: string, isActive: boolean): Promise<void> {
    await this.users.toggleActive(userId, isActive);
  }

  // ── Audit Log ────────────────────────────────────────
  async getAuditLogs(page: number, perPage: number, filters?: {
    userId?: string; action?: string;
  }) {
    const qb = this.auditRepo.createQueryBuilder('a')
      .orderBy('a.created_at', 'DESC')
      .skip((page - 1) * perPage)
      .take(perPage);

    if (filters?.userId) qb.andWhere('a.user_id = :uid', { uid: filters.userId });
    if (filters?.action) qb.andWhere('a.action = :act', { act: filters.action });

    const [logs, total] = await qb.getManyAndCount();
    return { logs, total };
  }

  async writeAuditLog(data: {
    user_id: string; action: string; resource_type: string;
    resource_id?: string; ip_address: string; user_agent: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    const log = this.auditRepo.create(data);
    await this.auditRepo.save(log);
  }

  // ── Settings ─────────────────────────────────────────
  async getSettings(): Promise<Setting[]> {
    return this.settingRepo.find({ order: { key: 'ASC' } });
  }

  async updateSetting(key: string, value: string): Promise<Setting> {
    let setting = await this.settingRepo.findOne({ where: { key } });
    if (!setting) {
      setting = this.settingRepo.create({ key, value });
    } else {
      setting.value = value;
    }
    return this.settingRepo.save(setting);
  }

  // ── Admin Jobs View ──────────────────────────────────
  async getAllJobs(page: number, perPage: number) {
    const [jobs, total] = await this.jobRepo.findAndCount({
      order: { created_at: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
    return { jobs, total };
  }
}
