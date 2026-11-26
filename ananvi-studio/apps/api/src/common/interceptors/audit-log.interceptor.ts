import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AdminService } from '../../modules/admin/admin.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly admin: AdminService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;

    // Only audit mutations
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next.handle();

    const user = req.user;
    if (!user?.sub) return next.handle();

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.admin.writeAuditLog({
            user_id: user.sub,
            action: `${method} ${req.route?.path || req.url}`,
            resource_type: context.getClass().name,
            resource_id: req.params?.id || null,
            ip_address: req.ip || req.connection?.remoteAddress || '0.0.0.0',
            user_agent: req.headers['user-agent'] || '',
            details: {
              duration_ms: Date.now() - startTime,
              status: 'success',
            },
          }).catch(() => {}); // Fire-and-forget
        },
        error: (err) => {
          this.admin.writeAuditLog({
            user_id: user.sub,
            action: `${method} ${req.route?.path || req.url}`,
            resource_type: context.getClass().name,
            resource_id: req.params?.id || null,
            ip_address: req.ip || req.connection?.remoteAddress || '0.0.0.0',
            user_agent: req.headers['user-agent'] || '',
            details: {
              duration_ms: Date.now() - startTime,
              status: 'error',
              error: err.message,
            },
          }).catch(() => {});
        },
      }),
    );
  }
}
