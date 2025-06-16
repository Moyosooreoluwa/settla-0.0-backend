import { UserRole } from '@prisma/client';
import { JwtPayload } from 'jsonwebtoken';
import { TokenPayload } from '../utils/auth';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload | JwtPayload;
    }
  }
}
