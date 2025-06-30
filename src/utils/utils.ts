import { PrismaClient, User } from '@prisma/client';
import { transporter } from '../server';

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
}: NotificationProps) => {
  await prisma.notification.create({
    data: {
      title,
      message,
      type: 'IN_APP',
      recipientId: recipientId || '',
    },
  });
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
