import express, { NextFunction } from 'express';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '@prisma/client';
import asyncHandler from 'express-async-handler';
import { AuthRequest, generateToken, isAgent, isAuth } from '../utils/auth';

const prisma = new PrismaClient();

const agentRouter = express.Router();

// Agent Routes

agentRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const {
      name,
      email,
      password,
      phone_number,
      logo,
      bio,
      verification_docs,
    } = req.body;

    if (!name || !email || !password || !phone_number) {
      res.status(400).send({ message: 'All fields are required' });
      return; // Added return
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      res.status(400).send({ message: 'User already exists' });
      return; // Added return
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        phone_number,
        password_hash: hashedPassword,
        role: 'agent',
        logo: logo || 'https://github.com/shadcn.png',
        verification_docs: verification_docs || [],
        is_verified: false,
        bio,
      },
    });

    const token = generateToken({ id: newUser.id, role: newUser.role });

    res.status(201).json({
      message: 'User registered successfully, pending verification review',
      isSignedIn: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone_number: newUser.phone_number,
        role: newUser.role,
        logo: newUser.logo,
        verification_docs: newUser.verification_docs,
        is_verified: newUser.is_verified,
        bio: newUser.bio,
      },
      token,
    });
  })
);

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
    // if (!user.is_verified) {
    //   res
    //     .status(400)
    //     .send({ message: 'Unauthorised. Please wait for Verification ' });
    //   //Please wait for verification
    //   //   return; // Added return to stop execution
    // }

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
        logo: user.logo,
        phone_number: user.phone_number,
        is_verified: user.is_verified,
        bio: user.bio,
      },
      token,
      isSignedIn: true,
    });
  })
);

//Get user info
agentRouter.get(
  '/profile/',
  isAuth,
  isAgent,
  asyncHandler(async (req, res) => {
    const agentId = req.user.id;
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new Error('No Agent found');
      return; // Added return to stop execution
    }

    res.json(agent);
  })
);

//edit profile

agentRouter.put(
  '/profile',
  isAuth,
  isAgent,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;

    const {
      name,
      email,
      phone_number,
      logo,
      password,
      verification_docs,
      bio,
    } = req.body as {
      name?: string;
      email?: string;
      phone_number: string;
      logo: string;
      password?: string;
      verification_docs?: [];
      bio?: string;
    };

    const agent = await prisma.user.findUnique({ where: { id: userId } });
    if (!agent) {
      res.status(404).send({ message: 'Agent not found' });
      return;
    }
    const updatedAgent = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name || agent.name,
        email: email || agent.email,
        phone_number: phone_number || agent.phone_number,
        logo: logo || agent.logo,
        bio: bio || agent.bio,
        password_hash: password
          ? bcrypt.hashSync(password, 8)
          : agent.password_hash,
        verification_docs,
      },
    });
    res.json({
      message: 'Profile updated successfully',
      isSignedIn: true,
      token: generateToken({ id: updatedAgent.id, role: updatedAgent.role }),
      user: {
        id: updatedAgent.id,
        name: updatedAgent.name,
        email: updatedAgent.email,
        phone_number: updatedAgent.phone_number,
        logo: updatedAgent.logo,
        role: updatedAgent.role,
        bio: updatedAgent.bio,
      },
    });
  })
);

// TODO ADD PAGINATION
//get all properties
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
    const response = await fetch(
      // `https://nominatim.openstreetmap.org/search?city=${req.body.city}&state=${req.body.state}&country=Nigeria&format=json`
      `https://nominatim.openstreetmap.org/search?q=${street},+${city},+${state},+Nigeria&format=json`
    );
    const [data] = await response.json();
    console.log(data);

    const lat = parseFloat(data?.lat);
    const lon = parseFloat(data?.lon);

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
        lat,
        lon,
        availability,
        tenancy_info,
        service_charge,
        min_tenancy,
        deposit,
        agent: { connect: { id: agentId } }, // Link to Agent (User)
      },
    });
    //TODO NOTIFY FOR APPROVAL

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

    console.log(req.body);

    const { state, city, street } = req.body;
    const { postal_code, ...rest } = req.body;

    const response = await fetch(
      // `https://nominatim.openstreetmap.org/search?city=${req.body.city}&state=${req.body.state}&country=Nigeria&format=json`
      `https://nominatim.openstreetmap.org/search?q=${street},+${city},+${state},+Nigeria&format=json`
      // `https://nominatim.openstreetmap.org/search?q=${city},+${state},+Nigeria&format=json`
      // `https://nominatim.openstreetmap.org/search?postalcode=${postal_code}&country=Nigeria&format=json`
    );
    const [data] = await response.json();

    const lat = parseFloat(data?.lat);
    const lon = parseFloat(data?.lon);

    // Update property
    const updatedProperty = await prisma.property.update({
      where: { id: propertyId },
      data: { ...rest, lat, lon }, // Updates only fields provided in the request body
    });
    //TODO NOTIFY FOR APPROVAL

    res.json(updatedProperty);
  })
);

export default agentRouter;
