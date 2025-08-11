import {
  SubscriptionTier,
  SubscriptionTierType,
  VisibilityLevel,
} from '@prisma/client';

export const TierVisibilityMap: Record<SubscriptionTierType, VisibilityLevel> =
  {
    basic: 'low',
    premium: 'medium',
    enterprise: 'high',
  };

export const TierFeatureLimits: Record<
  SubscriptionTierType,
  {
    maxListings: number;
    featuredSlots: number;
    visibility: VisibilityLevel;
  }
> = {
  basic: {
    maxListings: 5,
    featuredSlots: 1,
    visibility: 'low',
  },
  premium: {
    maxListings: 30,
    featuredSlots: 2,
    visibility: 'medium',
  },
  enterprise: {
    maxListings: 100,
    featuredSlots: 5,
    visibility: 'high',
  },
};
