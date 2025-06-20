import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'your_default_secret';
// TODO Use env for production!

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    // You can add more fields as needed
  };
}

export interface TokenPayload {
  id: string;
  role: 'buyer' | 'agent' | 'admin';
  // name: string;
  // email: string;
}

// Generate JWT Token
export const generateToken = (user: { id: string; role: UserRole }) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d' } // 30 days validity
  );
};

// Middleware to verify token and attach user to req
export const isAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      role: string;
    };
    req.user = decoded; // TypeScript now recognizes this!
    next();
  } catch (error) {
    res.status(401);
    throw new Error('Not authorized, token failed');
  }
};

// Check for Admin
export const isAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const user = req.user;
  if (req.user?.role === 'admin') {
    return next();
  }
  res.status(403).json({ message: 'Admin access required' });
};

// Check for Agent
// export const isAgent = (req: AuthRequest, res: Response, next: NextFunction) => {
//   if (req.user?.role === 'agent') {
//     return next();
//   }
//   return res.status(403).json({ message: 'Agent access required' });
// };
export const isAgent = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const user = req.user;

  if (user?.role === 'agent') {
    return next();
  }

  res.status(403).json({ message: 'Agent access required' });
};
