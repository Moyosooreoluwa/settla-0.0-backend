import { Request } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type LogActivityParams = {
  userId?: string;
  category:
    | 'AUTH'
    | 'ACCOUNT'
    | 'USER_ACTION'
    | 'CRITICAL'
    | 'SYSTEM'
    | 'ADMIN_ACTION';
  action: string;
  description?: string;
  req?: Request;
  changes?: { before: Record<string, any>; after: Record<string, any> };
  metadata?: Record<string, any>;
};

export async function logActivity({
  userId,
  category,
  action,
  description,
  req,
  changes,
  metadata = {},
}: LogActivityParams) {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        category,
        action,
        description,
        ipAddress: req?.ip || null,
        userAgent: req?.headers['user-agent'] || null,
        changes: changes
          ? { before: changes.before, after: changes.after }
          : undefined,
        metadata,
      },
    });
  } catch (error) {
    console.error('Failed to log activity', error);
  }
}
