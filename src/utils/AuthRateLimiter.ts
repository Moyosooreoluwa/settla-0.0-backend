// utils/authRateLimiter.js
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { Request, Response, NextFunction } from 'express';

const redisClient = new Redis(process.env.REDIS_URL || '');

const opts = {
  points: 10, // 10 attempts
  duration: 900, // per 15 minutes
  blockDuration: 900, // block 15 mins when limit is exceeded
};

export const authLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  ...opts,
});

export const authRateLimiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const key = req.ip || 'unknown_ip';
  // You can also use `${req.ip}_${req.body.email}` for stricter control

  try {
    await authLimiter.consume(key);
    next();
  } catch (error) {
    res.status(429).json({
      status: 'error',
      message:
        'Too many login attempts. Account temporarily locked. Try again in 15 minutes.',
    });
  }
};
