import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ClipsModule } from './modules/clips/clips.module';
import { BillingModule } from './modules/billing/billing.module';
import { AdminModule } from './modules/admin/admin.module';
import { McpModule } from './modules/mcp/mcp.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get('DB_HOST', 'localhost'),
        port: cfg.get<number>('DB_PORT', 5432),
        username: cfg.get('DB_USER', 'ananvi'),
        password: cfg.get('DB_PASS', 'ananvi_secret'),
        database: cfg.get('DB_NAME', 'ananvi_studio'),
        autoLoadEntities: true,
        synchronize: cfg.get('NODE_ENV') === 'development',
        logging: cfg.get('NODE_ENV') === 'development',
        ssl: cfg.get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
      }),
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: {
          host: cfg.get('REDIS_HOST', 'localhost'),
          port: cfg.get<number>('REDIS_PORT', 6379),
          password: cfg.get('REDIS_PASS', ''),
        },
      }),
    }),

    ThrottlerModule.forRoot([{
      name: 'short',  ttl: 1000,   limit: 10,
    }, {
      name: 'medium', ttl: 10000,  limit: 50,
    }, {
      name: 'long',   ttl: 60000,  limit: 200,
    }]),

    ScheduleModule.forRoot(),

    AuthModule,
    UsersModule,
    JobsModule,
    ClipsModule,
    BillingModule,
    AdminModule,
    McpModule,
  ],
})
export class AppModule {}
