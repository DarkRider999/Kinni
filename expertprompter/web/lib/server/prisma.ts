import { PrismaClient } from '@prisma/client';

// Reuse one client per serverless instance and across dev hot reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });

globalForPrisma.prisma = prisma;
