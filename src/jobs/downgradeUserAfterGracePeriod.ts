// This is a standalone script for a background job.
// It is intended to be run on a schedule (e.g., using a cron job).
import cron from 'node-cron';
import { Request as req } from 'express';

// Assuming you have Prisma Client configured
import { PrismaClient } from '@prisma/client';
import { logActivity } from '../utils/activityLogger';

const prisma = new PrismaClient();

/**
 * A scheduled job that finds and disables subscriptions that have passed
 * their grace period.
 *
 * This job should be run periodically to ensure that subscriptions with
 * failed payments are eventually deactivated after a grace period has
 * been given to the user. It also automatically downgrades the user
 * to a standard plan to maintain access.
 */
cron.schedule('0 0 * * *', () => {
  async function disableExpiredSubscriptions() {
    console.log(
      'Running scheduled job to disable expired subscriptions every day at midnight...'
    );

    try {
      // Step 1: Find a standard/free plan to assign to users who are being downgraded.
      // NOTE: This assumes you have a plan in your database named 'Standard Tier'.
      // You may need to adjust this query to match your schema (e.g., `isFree: true`).
      const standardPlan = await prisma.subscriptionPlan.findFirst({
        where: {
          tier: {
            name: 'standard',
          },
        },
      });

      if (!standardPlan) {
        console.error('Standard Tier plan not found. Cannot downgrade users.');
        return;
      }

      // Step 2: Find all active subscriptions where the gracePeriodEndDate is in the past.
      const subscriptionsToDisable = await prisma.subscription.findMany({
        where: {
          isActive: true,
          OR: [
            // Condition 1: The grace period has expired.
            {
              gracePeriodEndDate: {
                lte: new Date(),
              },
            },
            // Condition 2: The subscription's regular end date has passed.
            {
              endDate: {
                lte: new Date(),
              },
            },
          ],
        },
      });

      if (subscriptionsToDisable.length === 0) {
        console.log('No subscriptions found to disable.');
        return;
      }

      console.log(
        `Found ${subscriptionsToDisable.length} subscriptions to disable.`
      );

      // Step 3: Loop through the found subscriptions and update them.
      for (const subscription of subscriptionsToDisable) {
        // First, disable the expired subscription.
        const sub = await prisma.subscription.update({
          where: { id: subscription.id },
          include: { agent: true, plan: true },
          data: {
            isActive: false,
            gracePeriodEndDate: null, // Clear the grace period date once the subscription is disabled.
          },
        });

        await logActivity({
          category: 'USER_ACTION',
          action: 'USER_CANCEL_SUBSCRIPTION',
          description: `${sub.agent?.email} cancelled ${sub.plan.name} subscription`,
          metadata: { subscription, agent: sub.agent },
        });
        console.log(
          `Subscription ${subscription.id} for user ${subscription.agentId} has been disabled.`
        );

        // Then, create a new standard subscription for the user.
        await prisma.subscription.create({
          data: {
            agentId: subscription.agentId,
            planId: standardPlan.tierId,
            paystackPlanCode: null, // No Paystack plan code for a manually granted plan.
            paystackSubscriptionCode: null,
            paystackCustomerCode: null,
            paystackEmailToken: null,
            startDate: new Date(),
            endDate: null,
            nextPaymentDate: null,
            isActive: true,
            manuallyGranted: true, // Mark this subscription as manually granted.
          },
        });
        console.log(
          `User ${subscription.agentId} has been downgraded to the Standard Tier.`
        );
      }

      console.log('Scheduled job finished successfully.');
    } catch (error) {
      console.error('Error in disabling expired subscriptions job:', error);
    } finally {
      // Disconnect the Prisma Client to ensure the process can exit gracefully.
      await prisma.$disconnect();
    }
  }

  // Example of how to run the job.
  // For a production environment, you would typically use a dedicated
  // job scheduler (e.g., a cron job on your server, a cloud function,
  // or a library like `node-cron`).
  disableExpiredSubscriptions();
});
