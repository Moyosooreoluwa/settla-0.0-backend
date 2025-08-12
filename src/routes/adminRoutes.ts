import express from 'express';
import bcrypt from 'bcryptjs';
import { Duration, PrismaClient, User } from '@prisma/client';
import asyncHandler from 'express-async-handler';
import { generateToken, isAdmin, isAuth } from '../middleware/auth';
import {
  sendEmailNotificationToSingleUser,
  sendInAppNotificationToSingleUser,
} from '../utils/utils';
import paystack from '../utils/paystack';

const prisma = new PrismaClient();

const adminRouter = express.Router();

// Sign in
adminRouter.post(
  '/signin',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Fetch user and include their saved_properties
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      await req.logActivity({
        category: 'AUTH',
        action: 'FAILED_LOGIN',
        description: `Failed login attempt for ${email}`,
      });
      res.status(400).send({ message: 'Invalid email or password' });
      return;
    }
    if (user.role !== 'admin') {
      await req.logActivity({
        category: 'AUTH',
        action: 'FAILED_LOGIN',
        description: `Failed login attempt for ${email}`,
      });
      res.status(400).send({ message: 'Unauthorised' });
      return; // Added return to stop execution
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await req.logActivity({
        category: 'AUTH',
        action: 'FAILED_LOGIN',
        description: `Failed login attempt for ${email}`,
      });
      res.status(400).send({ message: 'Invalid email or password' });
      return; // Added return to stop execution
    }
    await req.logActivity({
      category: 'AUTH',
      action: 'USER_LOGIN',
      description: `${user.email} signed in`,
    });
    const token = generateToken({ id: user.id, role: user.role });
    res.status(200).json({
      message: 'Signin successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
      isSignedIn: true,
    });
  })
);

// TODO OTP FOR ADMIN
// Get all users
adminRouter.get(
  '/users',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    const {
      role = 'all',
      is_verified = 'all',
      searchTerm = '',
      page = '1',
      limit = '10',
    } = req.query as {
      role?: string;
      is_verified?: string;
      searchTerm?: string;
      page?: string;
      limit?: string;
    };

    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;

    // Build dynamic filter
    const where: any = {};

    if (role !== 'all') {
      where.role = role;
    }

    if (is_verified !== 'all') {
      where.is_verified = is_verified === 'true';
    }

    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const [users, totalItems] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { created_at: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.status(200).json({
      users,
      totalItems,
      page: pageNumber,
      pages: Math.ceil(totalItems / pageSize),
    });
  })
);

//get a user
adminRouter.get(
  '/users/:id',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    const userId = req.params.id;

    const user = await prisma.user.findUnique({
      where: { id: userId, role: 'buyer' },
      include: {
        saved_properties: true, // Saved Properties (for buyers)
      },
    });

    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    res.json(user);
  })
);

//soft delete a user
adminRouter.put(
  '/user/:id',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    const userId = req.params.id;
    const admin = await prisma.user.findUnique({ where: { id: req.user.id } });

    const user = await prisma.user.update({
      where: { id: userId, role: 'buyer' },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
    await req.logActivity({
      category: 'CRITICAL',
      action: 'ADMIN_DELETE_USER',
      description: `${admin?.email} deleted (soft) ${user.email}.`,
      metadata: { admin, user },
    });
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    res.json(user);
  })
);

//get an agent
adminRouter.get(
  '/agents/:id',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    const agentId = req.params.id;

    const agent = await prisma.user.findUnique({
      where: { id: agentId, role: 'agent' },
      include: {
        properties: true, // Saved Properties (for buyers)
        Subscriptions: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!agent) {
      res.status(404);
      throw new Error('Agent not found');
    }

    res.json(agent);
  })
);

//verify an agent

adminRouter.put(
  '/agents/:id/verify',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    const agentId = req.params.id;
    const { is_verified } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    const agent = await prisma.user.findUnique({
      where: { id: agentId, role: 'agent' },
    });

    if (!agent) {
      res.status(404);
      throw new Error('Agent not found');
    }
    const updatedAgent = await prisma.user.update({
      where: { id: agentId },
      data: {
        is_verified: is_verified,
      },
    });
    await req.logActivity({
      category: 'ADMIN_ACTION',
      action: 'ADMIN_VERIFY_AGENT',
      description: `${user?.email} verified agent ${agent.email}.`,
      metadata: { agent, user },
    });
    res.json(updatedAgent);
  })
);

// get all properties
adminRouter.get(
  '/properties',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    const {
      page = '1',
      limit = '10',
      searchTerm = '',
      status = 'all',
      approval_status = 'all',
      listing_type = 'all',
    } = req.query as {
      page?: string;
      limit?: string;
      searchTerm?: string;
      status?: string;
      approval_status?: string;
      listing_type?: string;
    };

    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;

    // Build dynamic filter
    const where: any = {};

    if (status !== 'all') {
      where.status = status;
    }

    if (approval_status !== 'all') {
      where.approval_status = approval_status;
    }

    if (listing_type !== 'all') {
      where.listing_type = listing_type;
    }

    if (searchTerm) {
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { id: { contains: searchTerm } },
        {
          agent: {
            name: { contains: searchTerm, mode: 'insensitive' },
          },
        },
      ];
    }

    const [properties, totalItems] = await prisma.$transaction([
      prisma.property.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { date_added: 'desc' },
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              email: true,
              phone_number: true,
              logo: true,
            },
          },
        },
      }),
      prisma.property.count({ where }),
    ]);

    res.status(200).json({
      properties,
      totalItems,
      page: pageNumber,
      pages: Math.ceil(totalItems / pageSize),
    });
  })
);

//get a property
adminRouter.get(
  '/properties/:id',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    const propertyId = req.params.id;

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        agent: {},
      }, // include agent info if needed
    });

    if (!property) {
      res.status(404);
      throw new Error('Property not found');
    }

    res.json(property);
  })
);

//get all subscriptions
adminRouter.get(
  '/subscriptions',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    const id = req.user?.id;
    if (!id) {
      res.status(400).send({ message: 'Unauthorised' });
      return;
    } // Added return to stop execution}
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.limit as string) || 10;
    const { status } = req.query;
    const where: any = {};

    if (status !== 'all') {
      if (status === 'true') {
        where.isActive = true;
      } else {
        where.isActive = false;
      }
    }

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          plan: { include: { SubscriptionPlan: true } },
          agent: true, // include tier info as well
        },
      }),
      prisma.subscription.count({ where }),
    ]);

    res.json({
      subscriptions,
      page,
      limit: pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / pageSize),
    });
  })
);

//cancel agent subscription
adminRouter.post(
  '/subscriptions/:agentId/cancel',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    if (!agentId) {
      res.status(401).send({ message: 'UNo agent found' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.is } });
    const subscription = await prisma.subscription.findFirst({
      where: { isActive: true, agentId: agentId },
      include: { agent: true, plan: true },
      orderBy: { startDate: 'desc' },
    });
    if (!subscription) {
      res.status(401).send({ message: 'No Active Subscription Found' });
      return;
    }
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        isActive: false,
      },
    });
    try {
      console.log(
        'Trying to cancel Paystack subscription:',
        subscription.paystackSubscriptionCode
      );

      await paystack.post(`/subscription/disable`, {
        code: `${subscription.paystackSubscriptionCode}`,
        token: `${subscription.paystackEmailToken}`,
      });
      console.log(
        `Cancelled Paystack subscription: ${subscription.paystackSubscriptionCode}`
      );
    } catch (err: any) {
      console.error(
        `Failed to cancel Paystack subscription: ${subscription.paystackSubscriptionCode}`,
        err.response?.data || err.message
      );
    }
    const plan = await prisma.subscriptionTier.findFirst({
      where: { name: 'basic' },
    });
    const planId = plan?.id || '';
    const now = new Date();
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const newSubscription = await prisma.subscription.create({
      data: {
        isActive: true,
        planId: planId,
        agentId: agentId.toString(),
        startDate: now,
        endDate: endDate,
        nextPaymentDate: endDate,
      },
    });
    await req.logActivity({
      category: 'ADMIN_ACTION',
      action: 'USER_CANCEL_SUBSCRIPTION',
      description: `${user?.email} cancelled ${subscription.plan.name} subscription of agent ${subscription.agent.email}`,
      metadata: { agent: subscription.agent, subscription },
    });
    res.status(200).json({
      message: 'Subscription cancelled, reset to basic.',
      data: newSubscription,
    });
  })
);

//change agent subscription
adminRouter.post(
  '/subscriptions/:agentId/change',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const { duration, name } = req.body;
    if (!agentId) {
      res.status(401).send({ message: 'No agent found' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    const subscription = await prisma.subscription.findFirst({
      where: { isActive: true, agentId: agentId },
      include: { plan: true, agent: true },
      orderBy: { startDate: 'desc' },
    });
    if (!subscription) {
      res.status(401).send({ message: 'No Active Subscription Found' });
      return;
    }
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        isActive: false,
      },
    });
    try {
      console.log(
        'Trying to cancel Paystack subscription:',
        subscription.paystackSubscriptionCode
      );

      await paystack.post(`/subscription/disable`, {
        code: `${subscription.paystackSubscriptionCode}`,
        token: `${subscription.paystackEmailToken}`,
      });
      console.log(
        `Cancelled Paystack subscription: ${subscription.paystackSubscriptionCode}`
      );
    } catch (err: any) {
      console.error(
        `Failed to cancel Paystack subscription: ${subscription.paystackSubscriptionCode}`,
        err.response?.data || err.message
      );
    }
    const plan = await prisma.subscriptionTier.findFirst({
      where: { name },
    });
    const planId = plan?.id || '';
    const now = new Date();
    let durationInDays = 30; // Default to monthly
    if (duration === 'YEARLY') durationInDays = 365;

    const endDate = new Date(
      now.getTime() + durationInDays * 24 * 60 * 60 * 1000
    );
    const newSubscription = await prisma.subscription.create({
      data: {
        isActive: true,
        planId: planId,
        agentId: agentId.toString(),
        startDate: now,
        endDate: endDate,
        nextPaymentDate: endDate,
      },
    });
    await req.logActivity({
      category: 'ADMIN_ACTION',
      action: 'USER_CREATE_SUBSCRIPTION',
      description: `${user?.email} created a new subscription ${subscription.plan.name} for ${subscription.agent.email}.`,
      metadata: { subscription: newSubscription, agent: user },
    });
    res.status(200).json({
      message: 'New Subscription Created.',
      data: newSubscription,
    });
  })
);

// approve/reject a property
adminRouter.patch(
  '/properties/:id/approval',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { approval_status, approval_notes } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(approval_status)) {
      res.status(400);
      throw new Error('Invalid approval status');
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    const property = await prisma.property.update({
      where: { id },
      data: {
        approval_status,
        approval_notes,
      },
    });
    await req.logActivity({
      category: 'ADMIN_ACTION',
      action: 'USER_APPROVE_REJECT_PROPERTY',
      description: `${user?.email} set ${property.id}'s approval status to  ${property.approval_status}.`,
      metadata: { property, user },
    });
    //TODO send notification
    const notificationData = {
      title: 'Approval Status Update',
      message: `Property ${property.id}, ${property.title} status updated to ${approval_status}. It is now available for on settla.`,
      recipientd: property.agentId || '',
    };
    await sendInAppNotificationToSingleUser(notificationData);

    res.status(200).json({
      message: `Property status updated to ${approval_status}`,
      property,
    });
  })
);

// all leads
adminRouter.get(
  '/leads',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    const {
      page = '1',
      limit = '10',
      status = 'all',
    } = req.query as {
      page?: string;
      limit?: string;
      status?: string;
    };
    const adminId = req.user.id;

    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;
    const where: any = {};

    if (!adminId) {
      res.status(400).json({ message: 'Unauthorised' });
      return;
    }
    if (status !== 'all') {
      where.status = status;
    }

    const [leads, totalItems] = await prisma.$transaction([
      prisma.lead.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lead.count({ where }),
    ]);
    res.status(201).json({
      leads,
      totalItems,
      page: pageNumber,
      pages: Math.ceil(totalItems / pageSize),
    });
  })
);

// single lead
adminRouter.get(
  '/leads/:id',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    const adminId = req.user.id;
    const leadId = req.params.id;
    if (!adminId) {
      res.status(400).json({ message: 'Unauthorised' });
      return;
    }
    if (!leadId) {
      res.status(400).json({ message: 'Lead not found' });
      return;
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });
    res.status(201).json(lead);
  })
);

adminRouter.put(
  '/leads/:id/status',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    const adminId = req.user.id;
    const leadId = req.params.id;
    const { status, closure_reason } = req.body as {
      status: 'new' | 'contacted' | 'in_progress' | 'closed';
      closure_reason?: string;
    };
    if (!adminId) {
      res.status(400).json({ message: 'Unauthorised' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: adminId } });
    if (!leadId) {
      res.status(400).json({ message: 'Lead not found' });
      return;
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });
    if (!lead) {
      res.status(400).json({ message: 'Lead not found' });
      return;
    }
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      include: { agent: true, user: true },
      data: {
        status,
        closure_reason,
      },
    });
    await req.logActivity({
      category: 'ADMIN_ACTION',
      action: 'USER_UPDATE_LEAD',
      description: `${user?.email} updated a lead for ${updatedLead.agent?.name}.`,
      changes: { before: lead, after: updatedLead },
      metadata: {
        lead: updatedLead,
        user,
        agent: updatedLead.agent,
      },
    });
    // TODO Notify both user and agent about updated
    res.status(200).json(updatedLead);
  })
);

adminRouter.get(
  '/notifications',
  isAuth,
  isAdmin, // Assuming only admins can access all notifications
  asyncHandler(async (req, res) => {
    const {
      page = '1',
      limit = '10',
      type = 'all',
      searchTerm = '',
    } = req.query as {
      page?: string;
      limit?: string;
      type?: string;
      searchTerm?: string;
    };

    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;

    // Building the Prisma `where` filter dynamically
    const where: any = {};

    if (type !== 'all') {
      where.type = type; // Filter by type if specified
    }

    if (searchTerm) {
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        {
          recipient: {
            OR: [
              { name: { contains: searchTerm, mode: 'insensitive' } },
              { email: { contains: searchTerm, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [notifications, totalItems] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          recipient: {
            // Include full recipient info
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              logo: true,
            },
          },
        },
      }),
      prisma.notification.count({ where }),
    ]);

    res.status(200).json({
      notifications,
      totalItems,
      page: pageNumber,
      pages: Math.ceil(totalItems / pageSize),
    });
  })
);

//Create Notifications

adminRouter.post(
  '/notifications/create',
  isAuth,
  isAdmin, // assuming only admin can send notifications
  asyncHandler(async (req, res) => {
    const { title, message, recipients, recipientGroup, type } = req.body;
    console.log(req.body);

    if (!title || !message || !recipientGroup) {
      res.status(400).json({ message: 'Missing required fields' });
    }

    let targetUsers: User[] | User = [];

    // Handle group-based recipients
    if (recipientGroup && recipientGroup !== 'INDIVIDUAL') {
      if (recipientGroup === 'ALL_USERS') {
        targetUsers = await prisma.user.findMany();
      } else if (recipientGroup === 'ALL_AGENTS') {
        targetUsers = await prisma.user.findMany({ where: { role: 'agent' } });
      } else if (recipientGroup === 'ALL_BUYERS') {
        targetUsers = await prisma.user.findMany({ where: { role: 'buyer' } });
      } else {
        res.status(400).json({ message: 'Invalid recipient group' });
      }
    } else if (recipients && Array.isArray(recipients)) {
      // Handle specific user IDs
      targetUsers = await prisma.user.findMany({
        where: { id: { in: recipients } },
      });
    } else if (recipients && !Array.isArray(recipients)) {
      const user = await prisma.user.findMany({
        where: { id: recipients },
      });
      targetUsers = user;
    }

    if (targetUsers.length === 0) {
      res.status(404).json({ message: 'No target users found' });
    }

    // Create in-app notifications
    if (type === 'IN_APP' || type === 'BOTH') {
      targetUsers.map((user) =>
        sendInAppNotificationToSingleUser({
          title,
          message,
          recipientId: user.id,
        })
      );
    }

    // TODO: Send Email Notifications (optional):
    if (type === 'EMAIL' || type === 'BOTH') {
      for (const user of targetUsers) {
        await sendEmailNotificationToSingleUser({
          email: user.email,
          title,
          message,
          recipientId: user.id,
        });
      }
    }

    res.status(201).json({ message: 'Notifications sent successfully' });
  })
);

// get plans
adminRouter.get(
  '/plans',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    const plans = await prisma.subscriptionPlan.findMany({
      include: { tier: true },
    });
    res.json(plans);
  })
);

adminRouter.get(
  '/tiers',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    try {
      const tiers = await prisma.subscriptionTier.findMany({
        include: {
          SubscriptionPlan: true,
          subscriptions: true,
        },
        orderBy: {
          rank: 'asc', // optional: order by createdAt or name instead
        },
      });

      const formatted = tiers.map((tier) => {
        const monthlyPlan = tier.SubscriptionPlan.find(
          (p) => p.duration === 'MONTHLY'
        );

        const yearlyPlan = tier.SubscriptionPlan.find(
          (p) => p.duration === 'YEARLY'
        );
        const activeSubs = tier.subscriptions.filter(
          (p) => p.isActive === true
        );

        return {
          id: tier.id,
          name: tier.name,
          features: tier.features,
          description: tier.description,
          monthlyPrice: monthlyPlan?.price || 0,
          yearlyPrice: yearlyPlan?.price || 0,
          activeSubs,
        };
      });

      res.json(formatted);
    } catch (error) {
      console.error('Error fetching tiers:', error);
      res.status(500).json({ message: 'Failed to fetch subscription tiers' });
    }
  })
);

adminRouter.put(
  '/tiers/:id',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, features, monthlyPrice, yearlyPrice, description } =
      req.body as {
        name?: 'basic' | 'premium' | 'enterprise';
        features?: string[];
        monthlyPrice?: number;
        yearlyPrice?: number;
        description: string;
      };

    // Validate input
    if (!name || monthlyPrice == null || yearlyPrice == null) {
      res.status(400).json({ message: 'Missing required fields' });
    }

    const tier = await prisma.subscriptionTier.findUnique({
      where: { id },
      include: { SubscriptionPlan: true },
    });

    if (!tier) {
      res.status(404).json({ message: 'Subscription tier not found' });
    }

    // Update tier info
    await prisma.subscriptionTier.update({
      where: { id },
      data: {
        name,
        features,
        description,
        updatedAt: new Date(),
      },
    });

    // Update or create plans
    for (const duration of [Duration.MONTHLY, Duration.YEARLY]) {
      const price = duration === Duration.MONTHLY ? monthlyPrice : yearlyPrice;

      const existingPlan = tier?.SubscriptionPlan.find(
        (plan) => plan.duration === duration
      );

      if (existingPlan) {
        // Update existing
        await prisma.subscriptionPlan.update({
          where: { id: existingPlan.id },
          data: { price },
        });
      } else {
        // Create if missing
        await prisma.subscriptionPlan.create({
          data: {
            tierId: tier?.id || '',
            duration,
            price: price || 0,
          },
        });
      }
    }

    res.status(200).json({ message: 'Subscription tier updated successfully' });
  })
);

adminRouter.post(
  '/tiers',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    try {
      const { name, features, monthlyPrice, yearlyPrice } = req.body;

      if (!name || monthlyPrice == null || yearlyPrice == null) {
        res.status(400).json({ message: 'Missing required fields' });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      const newTier = await prisma.subscriptionTier.create({
        data: {
          name, // must match enum: 'basic' | 'premium' | 'enterprise'
          features,
          SubscriptionPlan: {
            create: [
              { duration: 'MONTHLY', price: monthlyPrice },
              { duration: 'YEARLY', price: yearlyPrice },
            ],
          },
        },
        include: {
          SubscriptionPlan: true,
        },
      });
      req.logActivity({
        category: 'ADMIN_ACTION',
        action: 'USER_CREATE_TIER',
        description: `${user?.email} created a new subscription tier.`,
        metadata: { user, tier: newTier },
      });

      res.status(201).json(newTier);
    } catch (error) {
      console.error('Create Tier Error:', error);
      res.status(500).json({ message: 'Failed to create subscription tier' });
    }
  })
);

adminRouter.delete(
  '/tiers/:id',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      // First delete associated plans
      await prisma.subscriptionPlan.deleteMany({
        where: { tierId: id },
      });

      // Then delete the tier itself
      const tier = await prisma.subscriptionTier.delete({
        where: { id },
      });
      req.logActivity({
        category: 'CRITICAL',
        action: 'USER_DELETE_TIER',
        description: `${user?.email} deleted subscription tier ${tier.id}.`,
        metadata: { user, tier },
      });

      res.json({ message: 'Subscription tier and plans deleted successfully' });
    } catch (error) {
      console.error('Delete Tier Error:', error);
      res.status(500).json({ message: 'Failed to delete subscription tier' });
    }
  })
);

//get all payments
adminRouter.get(
  '/payments',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.limit as string) || 10;
    const { status, provider, purpose } = req.query;
    const where: any = {};

    if (status !== 'all') {
      where.status = status;
    }
    if (provider !== 'all') {
      where.provider = provider;
    }
    if (purpose !== 'all') {
      where.purpose = purpose;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        // where: { userId },
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          subscription: { include: { plan: true } },
        },
      }),

      prisma.payment.count({
        where,
      }),
    ]);

    res.json({
      payments,
      page,
      limit: pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / pageSize),
    });
  })
);

//edit payment
adminRouter.put(
  '/payments/:id',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    const paymentId = req.params.id;
    const { status } = req.body;
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) {
      res.status(404);
      throw new Error('Payment not found');
    }
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status,
      },
    });
    req.logActivity({
      category: 'ADMIN_ACTION',
      action: 'USER_EDIT_PAYMENT',
      description: `${user?.email} edited payment ${payment.id}.`,
      changes: { before: payment, after: updatedPayment },
      metadata: { user, payment: updatedPayment },
    });

    res.json(updatedPayment);
  })
);

//manual payments
adminRouter.post(
  '/manual-payments',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    const { planId, reference, amount, userId, purpose, status } = req.body;
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id: planId },
      include: { tier: true },
    });

    if (!plan) {
      res.status(404).json({ message: 'Plan not found' });
      return;
    }

    if (purpose === 'SUBSCRIPTION') {
      const subscription = await prisma.subscription.findFirst({
        where: { isActive: true, agentId: userId },
        orderBy: { startDate: 'desc' },
      });
      // if (!subscription) {
      //   res.status(401).send({ message: 'No Active Subscription Found' });
      //   return;
      // }
      if (subscription) {
        await prisma.subscription.update({
          where: { id: subscription?.id },
          data: {
            isActive: false,
          },
        });
        try {
          console.log(
            'Trying to cancel Paystack subscription:',
            subscription?.paystackSubscriptionCode
          );

          await paystack.post(`/subscription/disable`, {
            code: `${subscription?.paystackSubscriptionCode}`,
            token: `${subscription?.paystackEmailToken}`,
          });
          console.log(
            `Cancelled Paystack subscription: ${subscription?.paystackSubscriptionCode}`
          );
        } catch (err: any) {
          console.error(
            `Failed to cancel Paystack subscription: ${subscription?.paystackSubscriptionCode}`,
            err.response?.data || err.message
          );
        }
      }

      const now = new Date();
      let durationInDays = 30; // Default to monthly
      if (plan.duration === 'YEARLY') durationInDays = 365;

      const endDate = new Date(
        now.getTime() + durationInDays * 24 * 60 * 60 * 1000
      );
      const newSubscription = await prisma.subscription.create({
        data: {
          isActive: true,
          planId: plan.tierId,
          agentId: userId.toString(),
          startDate: now,
          endDate: endDate,
          nextPaymentDate: endDate,
        },
      });
      const payment = await prisma.payment.create({
        data: {
          userId,
          reference,
          amount,
          provider: 'MANUAL',
          status,
          purpose,
          subscriptionId: newSubscription.id,
          createdAt: new Date(),
        },
      });
      req.logActivity({
        category: 'ADMIN_ACTION',
        action: 'USER_CREATE_PAYMENT',
        description: `${user?.email} created payment ${payment.id}.`,
        metadata: { user, payment },
      });
      res.json({
        message: 'Manual subscription and payment granted successfully',
      });
    } else {
      const payment = await prisma.payment.create({
        data: {
          userId,
          reference,
          amount,
          provider: 'MANUAL',
          status,
          purpose,
          createdAt: new Date(),
        },
      });
      req.logActivity({
        category: 'ADMIN_ACTION',
        action: 'USER_CREATE_PAYMENT',
        description: `${user?.email} created payment ${payment.id}.`,
        metadata: { user, payment },
      });
      res.json({ message: 'Manual payment granted successfully' });
    }
  })
);

export default adminRouter;
