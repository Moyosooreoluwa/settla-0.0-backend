import { PrismaClient, User } from '@prisma/client';
import { transporter } from '../server';
import { sendNotificationToUser } from './socket';

const prisma = new PrismaClient();

interface NotificationProps {
  title: string;
  message: string;
  recipientId?: string;
  email?: string;
}

export const sendInAppNotificationToSingleUser = async ({
  title,
  message,
  recipientId,
  relatedEntityId,
  category,
}: NotificationProps & {
  relatedEntityId?: string;
  category?: 'SUBSCRIPTION' | 'PAYMENT' | 'ANALYTICS' | 'SYSTEM';
}) => {
  await prisma.notification.create({
    data: {
      title,
      message,
      type: 'IN_APP',
      recipientId: recipientId || '',
      //TODO ADD THIS LATER
      // relatedEntityId:relatedEntityId||"",
      // category,
    },
  });
  sendNotificationToUser(recipientId || '', { title, message });
};

export const sendEmailNotificationToSingleUser = async ({
  title,
  message,
  email,
  recipientId,
}: NotificationProps) => {
  await transporter.sendMail({
    from: `"Settla-0.0 Test" <${process.env.SMTP_USER}>`,
    to: email,
    subject: title,
    text: message,
  });
  await prisma.notification.create({
    data: { title, message, type: 'EMAIL', recipientId: recipientId || '' },
  });
};
