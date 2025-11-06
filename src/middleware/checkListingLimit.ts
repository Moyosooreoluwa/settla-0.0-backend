import { Request, Response, NextFunction } from 'express';
import { TierFeatureLimits } from './visibilityConfig';
import {
  PrismaClient,
  SubscriptionTier,
  SubscriptionTierType,
} from '@prisma/client';
const prisma = new PrismaClient();

export const checkListingLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const agentId = req.user.id;

  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: {
      role: true,
      properties: { select: { id: true } },
    },
  });

  if (!agent || agent.role !== 'agent') {
    res.status(403).json({ message: 'Not authorized' });
    return;
  }

  const activeSub = await prisma.subscription.findMany({
    where: {
      agentId,
      isActive: true,
    },
    include: { plan: true },
    orderBy: { endDate: 'desc' },
  });

  if (!activeSub.length || !activeSub[0].plan) {
    res.status(403).json({
      message: 'You do not have an active subscription plan.',
    });
  }
  const planName = activeSub[0].plan.name;

  const tier = planName as SubscriptionTierType; // 'Standard' | 'pro' | 'premium'
  const limit = TierFeatureLimits[tier].maxListings;

  if (agent?.properties?.length && agent.properties.length >= limit) {
    res.status(403).json({
      message: `You have reached your listing limit (${limit}) for your current plan. To add more listings please upgrade.`,
    });
    return;
  }

  next();
};
