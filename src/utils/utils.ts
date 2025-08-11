import { PrismaClient, User } from '@prisma/client';
import { transporter } from '../server';
import { sendNotificationToUser } from './socket';
import { logActivity } from './activityLogger';

const prisma = new PrismaClient();

interface NotificationProps {
  title: string;
  message: string;
  recipientId?: string;
  email?: string;
}

interface VerificationEmailProps {
  email: string;
  verifyUrl: string;
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
  const user = await prisma.user.findUnique({ where: { id: recipientId } });
  const notification = await prisma.notification.create({
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
  await logActivity({
    category: 'SYSTEM',
    action: 'SEND_NOTIFICATION',
    description: `${user?.email} received email notification .`,
    metadata: { notification },
  });
  sendNotificationToUser(recipientId || '', { title, message });
};

export const sendEmailNotificationToSingleUser = async ({
  title,
  message,
  email,
  recipientId,
}: NotificationProps) => {
  const user = await prisma.user.findUnique({ where: { id: recipientId } });
  await transporter.sendMail({
    from: `"Settla-0.0 Test" <${process.env.SMTP_USER}>`,
    to: email,
    subject: title,
    text: message,
  });
  const notification = await prisma.notification.create({
    data: { title, message, type: 'EMAIL', recipientId: recipientId || '' },
  });
  await logActivity({
    category: 'SYSTEM',
    action: 'SEND_NOTIFICATION',
    description: `${user?.email} received email notification .`,
    metadata: { notification },
  });
};

export const sendVerificationEmail = async ({
  verifyUrl,
  email,
}: VerificationEmailProps) => {
  await transporter.sendMail({
    from: `"Settla-0.0 Test" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Verify your email',
    html: `<p>To verify your email,  <a href="${verifyUrl}">Click here</a>.</p>`,
  });
};

export const sendResetPasswordEmail = async ({
  resetUrl,
  email,
}: {
  resetUrl: string;
  email: string;
}) => {
  await transporter.sendMail({
    from: `"Settla-0.0 Test" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Verify your email',
    html: `<p>Click the link to reset your password:</p><a href="${resetUrl}">${resetUrl}</a>`,
  });
};
export const sendPasswordChangedEmail = async ({
  email,
}: {
  email: string;
}) => {
  await transporter.sendMail({
    from: `"Settla-0.0 Test" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Your Password has been changed',
    html: `<p>Your Password has been changed</p>`,
  });
};

export const send2FACodeEmail = async ({
  email,
  code,
}: {
  email: string;
  code: string;
}) => {
  await transporter.sendMail({
    from: `"Settla-0.0 Test" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Your 2FA Code',
    text: `Your login verification code is: ${code}`,
  });
};
