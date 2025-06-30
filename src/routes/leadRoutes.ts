import express, { NextFunction } from 'express';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '@prisma/client';
import asyncHandler from 'express-async-handler';
import {
  AuthRequest,
  generateToken,
  isAgent,
  isAgentOrAdmin,
  isAuth,
} from '../utils/auth';
import {
  sendEmailNotificationToSingleUser,
  sendInAppNotificationToSingleUser,
} from '../utils/utils';

const prisma = new PrismaClient();

const leadRouter = express.Router();

// Create lead
leadRouter.post(
  '/create',
  isAuth, //For now, only users with accounts can contact agents
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { message, propertyId, email, name } = req.body;
    // Validate required fields
    if (!propertyId || !message || !userId || !email || !name) {
      res
        .status(400)
        .json({ message: 'Please sign in and fill all required fields' });
      return;
    }

    // Optionally check if the property exists
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property) {
      res.status(404).json({ message: 'Property not found' });
      return;
    }
    const agent = await prisma.user.findUnique({
      where: { id: property.agentId || '', role: 'agent' },
    });

    const newLead = await prisma.lead.create({
      data: {
        propertyId,
        message,
        email,
        name,
        status: 'new', // default to 'new' if not provided
        userId, // the user creating the lead
        agentId: property.agentId, // optional, can derive from property if needed
      },
    });
    const newInAppNotification = await sendInAppNotificationToSingleUser({
      recipientId: property.agentId || '',
      title: `New Lead Received - ${agent?.name || 'Agent'}`,
      message: `A new lead has been created for your property: ${propertyId}. Head over to your leads page to view details.`,
    });

    // TODO send email notification.
    // const newEmailNotification = await sendEmailNotificationToSingleUser({
    //   recipientId: property.agentId || '',
    //   title: `New Lead Received - ${agent?.name || 'Agent'}`,
    //   message: `A new lead has been created for your property: ${propertyId}. Head over to your leads page to view details.`,
    //   email: agent?.email,
    // });

    res.status(201).json({
      newLead,
      newInAppNotification,
      // , newEmailNotification
    });
  })
);

//Get all leads of an agent
leadRouter.get(
  '/agent',
  isAuth,
  isAgent,
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
    const agentId = req.user.id;

    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;
    const where: any = {};

    if (!agentId) {
      res.status(400).json({ message: 'Unauthorised' });
      return;
    }
    if (status !== 'all') {
      where.status = status;
    }
    where.agentId = agentId;

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

// get a particular lead of an agent
leadRouter.get(
  '/agent/:id',
  isAuth,
  isAgent,
  asyncHandler(async (req, res) => {
    const agentId = req.user.id;
    const leadId = req.params.id;
    if (!agentId) {
      res.status(400).json({ message: 'Unauthorised' });
      return;
    }
    if (!leadId) {
      res.status(400).json({ message: 'Lead not found' });
      return;
    }

    const lead = await prisma.lead.findUnique({
      where: { agentId: agentId, id: leadId },
    });
    res.status(201).json(lead);
  })
);

// change lead status

leadRouter.put(
  '/:id/status',
  isAuth,
  isAgent,
  asyncHandler(async (req, res) => {
    const agentId = req.user.id;
    const leadId = req.params.id;
    const { status, closure_reason } = req.body as {
      status: 'new' | 'contacted' | 'in_progress' | 'closed';
      closure_reason?: string;
    };
    if (!agentId) {
      res.status(400).json({ message: 'Unauthorised' });
      return;
    }
    if (!leadId) {
      res.status(400).json({ message: 'Lead not found' });
      return;
    }

    const lead = await prisma.lead.findUnique({
      where: { agentId: agentId, id: leadId },
    });
    if (!lead) {
      res.status(400).json({ message: 'Lead not found' });
      return;
    }
    const updatedLead = await prisma.lead.update({
      where: { id: leadId, agentId: agentId },
      data: {
        status,
        closure_reason,
      },
    });
    // Notify both user and agent about updated
    res.status(200).json(updatedLead);
  })
);

export default leadRouter;
