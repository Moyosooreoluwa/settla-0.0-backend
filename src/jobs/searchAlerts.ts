import cron from 'node-cron';
import { PrismaClient, User } from '@prisma/client';
import { sendInAppNotificationToSingleUser } from '../utils/utils';

const prisma = new PrismaClient();

// Runs every 10 minutes -'*/10 * * * *'
// Runs every 1 hour - '0 * * * *'
// Runs every 1 week - '0 0 * * 1'

cron.schedule('0 0 * * 1', async () => {
  console.log('Running Saved Search Alerts job');

  const savedSearches = await prisma.savedSearch.findMany({
    where: { sendAlerts: true },
    include: { user: true },
  });

  for (const search of savedSearches) {
    const filters =
      typeof search.query === 'object' && search.query !== null
        ? search.query
        : {};
    const lastChecked = search.last_checked ?? new Date(0);
    const newProperties = await prisma.property.findMany({
      where: {
        date_added: { gt: lastChecked },
        ...(filters as any), // Cast only after validation
      },
    });

    const matchCount = newProperties.length;

    if (matchCount > 0) {
      // Save alert log
      await prisma.searchAlertLog.create({
        data: {
          searchId: search.id,
          result_count: matchCount,
          method: 'IN_APP',
          userId: search.userId,
        },
      });

      // Send notification
      await sendInAppNotificationToSingleUser({
        recipientId: search.userId,
        title: `New listings match your saved search`,
        message: `We found ${matchCount} new properties since your last check.`,
      });

      // Optional: send email
      // await sendEmailNotificationToSingleUser({
      //   email: search.user.email,
      //   title: `New listings match your saved search`,
      //   message: `We found ${matchCount} new properties since your last check.`,
      //   recipientId: search.userId,
      // });
    }

    // Update lastChecked
    await prisma.savedSearch.update({
      where: { id: search.id },
      data: { last_checked: new Date() },
    });
  }
});
