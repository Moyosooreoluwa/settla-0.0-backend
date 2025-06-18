import express, { NextFunction } from 'express';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '@prisma/client';
import asyncHandler from 'express-async-handler';
import { AuthRequest, generateToken, isAgent, isAuth } from '../utils/auth';

const prisma = new PrismaClient();

const agentRouter = express.Router();

// Agent Routes

// Agent Sign in
agentRouter.post(
  '/signin',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Fetch user and include their saved_properties
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(400).send({ message: 'Invalid email or password' });
      return; // Added return to stop execution
    }
    if (user.role !== 'agent') {
      res.status(400).send({ message: 'Unauthorised' });
      //   return; // Added return to stop execution
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(400).send({ message: 'Invalid email or password' });
      //   return; // Added return to stop execution
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
        phone_number: user.phone_number,
      },
      token,
      isSignedIn: true,
    });
  })
);

// Get all Properties owned by Agent
// TODO ADD PAGINATION
// agentRouter.get(
//   '/properties',
//   isAuth,
//   isAgent,
//   asyncHandler(async (req, res) => {
//     const agentId = req.user?.id;

//     if (!agentId) {
//       res.status(401).send({ message: 'User not authenticated' });
//     }
//     const properties = await prisma.property.findMany({
//       where: { agentId: agentId },
//       orderBy: { date_added: 'desc' },
//     });

//     res.json(properties);
//   })
// );

agentRouter.get(
  '/properties',
  isAuth,
  isAgent,
  asyncHandler(async (req: Request, res: Response) => {
    const agentId = (req as AuthRequest).user?.id;

    if (!agentId) {
      res.status(401).send({ message: 'User not authenticated' });
      return;
    }

    // --- Filtering and Searching ---
    const {
      approvalStatus,
      listingType,
      status,
      searchTerm,
      page = '1', // Default to page 1
      limit = '10', // Default to 10 items per page
    } = req.query;

    const pageSize = parseInt(limit as string, 10);
    const currentPage = parseInt(page as string, 10);
    const skip = (currentPage - 1) * pageSize;

    const where: any = {
      // Use 'any' or define a more specific PrismaWhereInput type
      agentId: agentId,
    };

    if (approvalStatus && approvalStatus !== 'all') {
      where.approval_status = approvalStatus as string;
    }
    if (listingType && listingType !== 'all') {
      where.listing_type = listingType as string;
    }
    if (status && status !== 'all') {
      where.status = status as string;
    }

    if (searchTerm) {
      // Prisma's OR operator for searching across multiple fields
      where.OR = [
        { title: { contains: searchTerm as string, mode: 'insensitive' } }, // Case-insensitive search for title
        { id: { contains: searchTerm as string, mode: 'insensitive' } }, // Search by ID (if it's a string)
      ];
    }

    // --- Fetching Properties with Filters and Pagination ---
    const [properties, totalItems] = await prisma.$transaction([
      prisma.property.findMany({
        where,
        orderBy: { date_added: 'desc' },
        skip: skip,
        take: pageSize,
      }),
      prisma.property.count({ where }), // Get total count for pagination
    ]);

    res.json({
      properties,
      totalItems,
      page: currentPage,
      limit: pageSize,
      totalPages: Math.ceil(totalItems / pageSize),
    });
  })
);

// Get a listing

agentRouter.get(
  '/properties/:id',
  isAuth,
  isAgent,
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

// Add Listing
agentRouter.post(
  '/properties',
  isAuth,
  isAgent,
  asyncHandler(async (req, res) => {
    const {
      title,
      description,
      bedrooms,
      bathrooms,
      toilets,
      size_sqm,
      price,
      discount_percent,
      discounted_price,
      property_type,
      listing_type,
      furnishing,
      status,
      amenities,
      images,
      street,
      city,
      state,
      availability,
      tenancy_info,
      service_charge,
      min_tenancy,
      deposit,
    } = req.body;

    const agentId = req.user?.id; // from isAuth middleware

    const newProperty = await prisma.property.create({
      data: {
        title,
        description,
        bedrooms,
        bathrooms,
        toilets,
        size_sqm,
        price,
        discount_percent,
        discounted_price,
        property_type,
        listing_type,
        furnishing,
        status,
        amenities,
        images,
        street,
        city,
        state,
        availability,
        tenancy_info,
        service_charge,
        min_tenancy,
        deposit,
        agent: { connect: { id: agentId } }, // Link to Agent (User)
      },
    });

    res.status(201).json(newProperty);
  })
);

// Edit listing
agentRouter.put(
  '/properties/:id',
  isAuth,
  isAgent,
  asyncHandler(async (req, res) => {
    const propertyId = req.params.id;
    const agentId = req.user?.id;

    // Verify that the property belongs to this agent
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      res.status(404);
      throw new Error('Property not found');
    }

    if (property.agentId !== agentId) {
      res.status(403);
      throw new Error('Not authorized to edit this property');
    }

    // Update property
    const updatedProperty = await prisma.property.update({
      where: { id: propertyId },
      data: { ...req.body }, // Updates only fields provided in the request body
    });

    res.json(updatedProperty);
  })
);

export default agentRouter;
