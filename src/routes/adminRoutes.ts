import express from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient, User } from '@prisma/client';
import asyncHandler from 'express-async-handler';
import { generateToken, isAdmin, isAuth } from '../utils/auth';
import { transporter } from '../server';

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
      res.status(400).send({ message: 'Invalid email or password' });
      return;
    }
    if (user.role !== 'admin') {
      res.status(400).send({ message: 'Unauthorised' });
      return; // Added return to stop execution
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(400).send({ message: 'Invalid email or password' });
      return; // Added return to stop execution
    }
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
              profile_picture: true,
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

    const property = await prisma.property.update({
      where: { id },
      data: {
        approval_status,
        approval_notes,
      },
    });
    //TODO send notification

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
      data: {
        status,
        closure_reason,
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
          receipient: {
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
          receipient: {
            // Include full recipient info
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              profile_picture: true,
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
      await prisma.$transaction(
        targetUsers.map((user) =>
          prisma.notification.create({
            data: {
              title,
              message,
              type: 'IN_APP',
              receipientId: user.id,
            },
          })
        )
      );
    }

    // TODO: Send Email Notifications (optional):
    if (type === 'EMAIL' || type === 'BOTH') {
      // loop over `targetUsers` and send emails using nodemailer or any email service
      // Example placeholder:
      for (const user of targetUsers) {
        // await sendEmail(user.email, title, message);
        await transporter.sendMail({
          from: `"Settla-0.0 Test" <${process.env.SMTP_USER}>`,
          to: user.email,
          subject: title,
          text: message,
        });
      }
    }

    res.status(201).json({ message: 'Notifications sent successfully' });
  })
);

export default adminRouter;
