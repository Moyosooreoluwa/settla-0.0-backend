import { PrismaClient } from '@prisma/client';
import express from 'express';
import asyncHandler from 'express-async-handler';
import { isAuth } from '../middleware/auth';

const prisma = new PrismaClient();

const reportRouter = express.Router();

reportRouter.post(
  '/',
  isAuth,
  asyncHandler(async (req, res) => {
    const { targetType, targetId, reason, message, attachments, anonymous } =
      req.body;
    const reporterId = anonymous === true ? null : req.user.id;
    console.log(req.body);

    // Collect meta info
    const ip = req.ip || req.headers['x-forwarded-for'] || '';
    const ua = req.get('user-agent') || '';

    // Validate reporter
    const reporter = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!reporter && reporterId) {
      res.status(404).json({ error: 'Reporter not found' });
      return;
    }

    // Validate target and prepare data
    const reportData: any = {
      reporterId,
      targetType,
      reason,
      message,
      attachments,
      ipAddress: String(ip),
      userAgent: ua,
    };

    if (targetType === 'PROPERTY') {
      const property = await prisma.property.findUnique({
        where: { id: targetId },
      });
      if (!property) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }
      reportData.targetPropertyId = targetId;
    } else if (targetType === 'AGENT') {
      const user = await prisma.user.findUnique({ where: { id: targetId } });
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      reportData.targetUserId = targetId;
    } else {
      res.status(400).json({ error: 'Invalid target type' });
      return;
    }

    // Create the report
    const report = await prisma.report.create({
      data: {
        targetType,
        reason,
        message,
        attachments,
        ipAddress: String(ip),
        userAgent: ua,
        targetProperty:
          targetType === 'PROPERTY' ? { connect: { id: targetId } } : undefined,
        targetUser:
          targetType === 'USER' ? { connect: { id: targetId } } : undefined,
        reporter: anonymous
          ? undefined
          : reporterId
          ? { connect: { id: reporterId } }
          : undefined,
      },
    });

    await req.logActivity({
      category: 'CRITICAL',
      action: 'USER_REPORT',
      description: `${reporter?.email} filed a ${report.targetType} report`,
      metadata: { reporter, targetId },
    });

    // create admin notification (in-app and email)
    // await prisma.notification.create({
    //   data: {
    //     recipientId: /* admin user id or system admin user id */,
    //     title: `New report: ${reason}`,
    //     message: `A new report was filed for ${targetType} ${targetId}`,
    //     linkUrl: `/admin/reports/${report.id}`,
    //     metadata: { reportId: report.id },
    //   },
    // });
    res.status(201).json({ reportId: report.id });
  })
);

export default reportRouter;
