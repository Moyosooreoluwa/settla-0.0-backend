import {
  SubscriptionTier,
  SubscriptionTierType,
  VisibilityLevel,
} from '@prisma/client';

export const TierVisibilityMap: Record<SubscriptionTierType, VisibilityLevel> =
  {
    standard: 'low',
    pro: 'medium',
    premium: 'high',
  };

export const TierFeatureLimits: Record<
  SubscriptionTierType,
  {
    maxListings: number;
    featuredSlots: number;
    visibility: VisibilityLevel;
  }
> = {
  standard: {
    maxListings: 5,
    featuredSlots: 1,
    visibility: 'low',
  },
  pro: {
    maxListings: 30,
    featuredSlots: 2,
    visibility: 'medium',
  },
  premium: {
    maxListings: 100,
    featuredSlots: 5,
    visibility: 'high',
  },
};
