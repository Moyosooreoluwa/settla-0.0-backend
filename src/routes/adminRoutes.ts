import express, { NextFunction } from 'express';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '@prisma/client';
import asyncHandler from 'express-async-handler';
import {
  AuthRequest,
  generateToken,
  isAdmin,
  isAgent,
  isAuth,
} from '../utils/auth';
import agentRouter from './agentRoutes';

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
        profile_picture: user.profile_picture,
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

//get an agent
adminRouter.get(
  '/agents/:id',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    const agentId = req.params.id;

    const agent = await prisma.user.findUnique({
      where: { id: agentId, role: 'agent' },
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
      is_approved = 'all',
      listing_type = 'all',
    } = req.query as {
      page?: string;
      limit?: string;
      searchTerm?: string;
      status?: string;
      is_approved?: string;
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

    if (is_approved !== 'all') {
      where.is_approved = is_approved === 'true';
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
export default adminRouter;
