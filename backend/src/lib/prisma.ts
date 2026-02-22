/**
 * FYI Guard - Prisma Client Singleton
 *
 * Provides a shared PrismaClient instance across the application.
 * Prevents multiple instances in development (hot-reload safe).
 *
 * Usage:
 *   import { prisma } from '../lib/prisma';
 *   const users = await prisma.user.findMany();
 */

// @ts-expect-error - Types available after `npx prisma generate`
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: InstanceType<typeof PrismaClient> | undefined;
};

export const prisma: InstanceType<typeof PrismaClient> =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'warn', 'error']
        : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}