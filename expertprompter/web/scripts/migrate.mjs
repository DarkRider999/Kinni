// Runs during `vercel-build`: applies pending migrations and upserts the
// template catalog. Skipped when no database is configured, so preview
// deployments without a DATABASE_URL still build (guest mode only).
import { execSync } from 'node:child_process';

if (!process.env.DATABASE_URL) {
  console.log('[migrate] DATABASE_URL not set; skipping migrations (guest-only deployment).');
  process.exit(0);
}

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
run('npx prisma migrate deploy');
run('npx tsx prisma/seed.ts');
