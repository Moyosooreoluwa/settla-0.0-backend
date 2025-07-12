import express from 'express';
import asyncHandler from 'express-async-handler';
import { PrismaClient, VisibilityLevel } from '@prisma/client';
import data from '../utils/data';

const prisma = new PrismaClient();
const seedRouter = express.Router();

seedRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    // Optional: Clear existing data (order matters due to relations)
    await prisma.searchAlertLog.deleteMany({});
    await prisma.savedSearch.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.lead.deleteMany({});
    await prisma.property.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.subscriptionPlan.deleteMany({});
    await prisma.subscriptionTier.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.user.deleteMany({});

    // Step 1: Seed users and properties
    const createdUsers = await prisma.user.createMany({ data: data.users });
    const createdProperties = await prisma.property.createMany({
      data: data.properties,
    });

    // Step 2: Create subscription tiers
    const [basicTier, premiumTier, enterpriseTier] = await Promise.all([
      prisma.subscriptionTier.create({
        data: {
          name: 'basic',
          rank: 1,
          features: {
            maxListings: 'Up to 5 Listings',
            visibility: 'Basic profile visibility',
            leadAccess: 'Limited lead access',
            support: 'Email Support within 48 hours',
            analytics: false,
            accountManager: false,
            featuredBadge: false,
            boosters: false,
            pow: false,
          },
          description: 'Basic tier for entry-level agents',
        },
      }),
      prisma.subscriptionTier.create({
        data: {
          name: 'premium',
          rank: 2,
          features: {
            maxListings: 'Unlimited Listings',
            visibility: 'Priority profile visibility',
            leadAccess: 'Full access to leads',
            support: 'Email Support within 48 hours',
            analytics: 'Basic analytics',
            accountManager: false,
            featuredBadge: false,
            boosters: false,
            pow: false,
          },
          description: 'Full suite plan for large agencies',
        },
      }),
      prisma.subscriptionTier.create({
        data: {
          name: 'enterprise',
          rank: 3,
          features: {
            maxListings: 'Unlimited Listings',
            visibility: 'Top-tier profile visibility',
            leadAccess: 'Full access to leads',
            support: '24/7 Support',
            analytics: 'Advanced analytics',
            accountManager: 'Dedicated Account manager',
            featuredBadge: true,
            boosters: 'Access to boosters',
            pow: 'Access to "Property of the Week"',
          },
          description: 'Full suite plan for large agencies',
        },
      }),
    ]);

    // Step 3: Create subscription plans
    await prisma.subscriptionPlan.createMany({
      data: [
        {
          tierId: basicTier.id,
          duration: 'MONTHLY',
          price: 0,
        },
        {
          tierId: premiumTier.id,
          duration: 'MONTHLY',
          price: 5000,
          paystackPlanCode: 'PLN_hmqbgdegudsrnhg',
        },
        {
          tierId: premiumTier.id,
          duration: 'YEARLY',
          price: 55000,
          paystackPlanCode: 'PLN_i7bn4gajjge4hbm',
        },
        {
          tierId: enterpriseTier.id,
          duration: 'MONTHLY',
          price: 10000,
          paystackPlanCode: 'PLN_r2d48hghnbx2mvk',
        },
        {
          tierId: enterpriseTier.id,
          duration: 'YEARLY',
          price: 100000,
          paystackPlanCode: 'PLN_j8fusfihco7fhkq',
        },
      ],
    });

    // Step 4: Assign subscriptions to agents and set visibility
    const agents = await prisma.user.findMany({ where: { role: 'agent' } });

    for (const agent of agents) {
      let tier;
      let visibility: VisibilityLevel = 'low';

      const random = Math.floor(Math.random() * 3);
      if (random === 0) {
        tier = basicTier;
        visibility = 'low';
      } else if (random === 1) {
        tier = premiumTier;
        visibility = 'medium';
      } else {
        tier = enterpriseTier;
        visibility = 'high';
      }

      await prisma.subscription.create({
        data: {
          agentId: agent.id,
          planId: tier.id,
          startDate: new Date(),
          endDate: new Date(
            new Date().setFullYear(new Date().getFullYear() + 1)
          ),
          isActive: true,
          manuallyGranted: true,
        },
      });

      await prisma.property.updateMany({
        where: { agentId: agent.id },
        data: { visibility },
      });
    }

    res.send({
      message: 'Seeded successfully',
      users: createdUsers,
      properties: createdProperties,
    });
  })
);

export default seedRouter;
