import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from '../jobs/entities/job.entity';
import { Payment } from '../billing/entities/payment.entity';
import { AuditLog } from './entities/audit-log.entity';
import { Setting } from './entities/setting.entity';
import { User } from '../users/entities/user.entity';
import { Credit } from '../billing/entities/credit.entity';
import { CreditTransaction } from '../billing/entities/credit-transaction.entity';
import { UsersModule } from '../users/users.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([Job, Payment, AuditLog, Setting, User, Credit, CreditTransaction]), UsersModule],
  controllers: [AdminController],
  providers: [AdminService, AuditLogInterceptor],
  exports: [AdminService],
})
export class AdminModule {}
