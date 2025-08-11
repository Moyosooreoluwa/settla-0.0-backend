import { PrismaClient } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';

const prisma = new PrismaClient();

export interface ActivityLogOptions {
  category:
    | 'AUTH'
    | 'ACCOUNT'
    | 'USER_ACTION'
    | 'CRITICAL'
    | 'SYSTEM'
    | 'ADMIN_ACTION';
  action: string;
  description?: string;
  changes?: { before: Record<string, any>; after: Record<string, any> };
  metadata?: Record<string, any>;
}

declare global {
  namespace Express {
    interface Request {
      logActivity: (options: ActivityLogOptions) => Promise<void>;
    }
  }
}

export function activityLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  req.logActivity = async ({
    category,
    action,
    description,
    changes,
    metadata = {},
  }: ActivityLogOptions) => {
    try {
      await prisma.activityLog.create({
        data: {
          userId: req.user?.id || null, // Assuming req.user is set by auth middleware
          category,
          action,
          description,
          ipAddress: req.ip || null,
          userAgent: req.headers['user-agent'] || null,
          changes: changes
            ? { before: changes.before, after: changes.after }
            : undefined,
          metadata,
        },
      });
    } catch (error) {
      console.error('Activity logging failed', error);
    }
  };

  next();
}
