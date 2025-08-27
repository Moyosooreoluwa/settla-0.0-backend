import express from 'express';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient, SubscriptionTierType } from '@prisma/client';
import asyncHandler from 'express-async-handler';
import {
  AuthRequest,
  generateToken,
  isAgent,
  isAuth,
} from '../middleware/auth';
import {
  TierFeatureLimits,
  TierVisibilityMap,
} from '../middleware/visibilityConfig';
import { checkListingLimit } from '../middleware/checkListingLimit';
import * as crypto from 'crypto';

import paystack from '../utils/paystack';
import {
  calculateNewEndDate,
  generate2FACode,
  getBillingPeriod,
} from '../utils/data';
import {
  send2FACodeEmail,
  sendEmailNotificationToSingleUser,
} from '../utils/utils';
import { addDays } from 'date-fns';

const prisma = new PrismaClient();

const agentRouter = express.Router();

// Agent Routes

agentRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { name, email, phone_number, password, verification_docs, username } =
      req.body as {
        name: string;
        email: string;
        username: string;
        phone_number: string;
        password: string;
        verification_docs?: [];
      };

    if (!name || !email || !password || !phone_number || !username) {
      res.status(400).send({ message: 'All fields are required' });
      return; // Added return
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      res.status(400).send({ message: 'User already exists' });
      return; // Added return
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // const response = await fetch(
    //   // `https://nominatim.openstreetmap.org/search?city=${req.body.city}&state=${req.body.state}&country=Nigeria&format=json`
    //   `https://nominatim.openstreetmap.org/search?q=${address?.street},+${address?.city},+${address?.state},+Nigeria&format=json`
    // );
    // const [data] = await response.json();
    // console.log(data);

    // const lat = parseFloat(data?.lat);
    // const lon = parseFloat(data?.lon);
    // const updatedAddress = { ...address, lat, lon };

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        phone_number,
        username,
        password_hash: hashedPassword,
        role: 'agent',
        logo: 'https://github.com/shadcn.png',
        verification_docs: verification_docs || [],
        is_verified: false,
        twoFactorEnabled: true,
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
        is_verified: newUser.is_verified,
        bio: newUser.bio,
        subscriptionTier: 'basic',
        twoFactorEnabled: newUser.twoFactorEnabled,
      },
      token,
    });
  })
);

//check availability of username

agentRouter.get(
  '/check-username',
  asyncHandler(async (req, res) => {
    const { username, userId } = req.query as {
      username?: string;
      userId: string;
    };

    // 1. Handle missing username:
    if (!username || typeof username !== 'string' || username.trim() === '') {
      res.status(400).json({
        message: 'Username query parameter is required.',
        isTaken: false, // Or handle as an error if you prefer
      });
      return;
    }

    const agent = await prisma.user.findUnique({
      where: {
        role: 'agent',
        username,
      },
      select: {
        id: true, // Select a minimal field to confirm existence, e.g., id
      },
    });
    if (agent && agent.id !== userId) {
      // If an agent is found, the username is taken
      res.status(200).json({ isTaken: true, message: 'Username is taken.' });
      return;
    } else {
      // If no agent is found, the username is available
      res
        .status(200)
        .json({ isTaken: false, message: 'Username is available.' });
      return;
    }
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
      await req.logActivity({
        category: 'AUTH',
        action: 'FAILED_LOGIN',
        description: `Failed login attempt for ${email}`,
      });
      res.status(400).send({ message: 'Invalid email or password' });
      return; // Added return to stop execution
    }
    if (user.role !== 'agent') {
      await req.logActivity({
        category: 'AUTH',
        action: 'FAILED_LOGIN',
        description: `Failed login attempt for ${email}`,
      });
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
      await req.logActivity({
        category: 'AUTH',
        action: 'FAILED_LOGIN',
        description: `Failed login attempt for ${email}`,
      });
      res.status(400).send({ message: 'Invalid email or password' });
      //   return; // Added return to stop execution
    }

    const code = generate2FACode(); // e.g., '847392'
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorCode: code,
        twoFactorExpiresAt: expiry,
      },
    });

    await send2FACodeEmail({ email: user.email, code });

    res.status(200).json({
      message: '2FA code sent to email',
      twoFactorRequired: true,
      userId: user.id,
    });
  })
);

agentRouter.post(
  '/verify-2fa',
  asyncHandler(async (req, res) => {
    const { userId, code } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        saved_properties: true,
        saved_searches: true,
      },
    });
    if (!user || !user.twoFactorEnabled || !user.twoFactorCode) {
      await req.logActivity({
        category: 'AUTH',
        action: 'FAILED_LOGIN',
        description: `Failed login attempt for ${user?.email}`,
      });
      res.status(400).json({ message: '2FA not enabled or code missing' });
      return;
    }

    if (
      user.twoFactorCode !== code ||
      !user.twoFactorExpiresAt ||
      user.twoFactorExpiresAt < new Date()
    ) {
      await req.logActivity({
        category: 'AUTH',
        action: 'FAILED_LOGIN',
        description: `Failed login attempt for ${user?.email}`,
      });
      res.status(400).json({ message: 'Invalid or expired 2FA code' });
      return;
    }

    // Clear the code after success
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorCode: null,
        twoFactorExpiresAt: null,
        emailVerified: true,
      },
    });

    const activeSub = await prisma.subscription.findFirst({
      where: {
        agentId: user.id,
        isActive: true,
      },
      include: { plan: true },
      orderBy: { endDate: 'desc' },
    });
    console.log(activeSub);

    if (!activeSub) {
      console.log('No active plan');
      const tier = await prisma.subscriptionTier.findFirst({
        where: { name: 'basic' },
      });
      const now = new Date();
      const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const sub = await prisma.subscription.create({
        data: {
          manuallyGranted: true,
          agentId: user.id,
          planId: tier?.id || '',
          startDate: now,
          endDate,
          isActive: true,
        },
      });
    }

    await req.logActivity({
      category: 'AUTH',
      action: 'USER_LOGIN',
      description: `${user.email} signed in`,
    });
    const planName = activeSub?.plan?.name || 'basic';
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
        subscriptionTier: planName,
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
      username,
      phone_number,
      logo,
      password,
      verification_docs,
      bio,
      address,
      socials,
    } = req.body as {
      name?: string;
      email?: string;
      username?: string;
      phone_number: string;
      logo: string;
      password?: string;
      verification_docs?: [];
      bio?: string;
      address?: {
        street?: string;
        city?: string;
        state?: string;
      };
      socials: {
        facebook?: string;
        instagram?: string;
        linkedin?: string;
        twitter?: string;
      };
    };

    const agent = await prisma.user.findUnique({ where: { id: userId } });
    if (!agent) {
      res.status(404).send({ message: 'Agent not found' });
      return;
    }
    const response = await fetch(
      // `https://nominatim.openstreetmap.org/search?city=${req.body.city}&state=${req.body.state}&country=Nigeria&format=json`
      `https://nominatim.openstreetmap.org/search?q=${address?.street},+${address?.city},+${address?.state},+Nigeria&format=json`
    );
    const [data] = await response.json();
    console.log(data);

    const lat = parseFloat(data?.lat);
    const lon = parseFloat(data?.lon);
    const updatedAddress = { ...address, lat, lon };
    const updatedAgent = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name || agent.name,
        username: username || agent.username,
        email: email || agent.email,
        phone_number: phone_number || agent.phone_number,
        logo: logo || agent.logo,
        bio: bio || agent.bio,
        password_hash: password
          ? bcrypt.hashSync(password, 8)
          : agent.password_hash,
        verification_docs,
        socials: socials || agent.socials,
        address: updatedAddress,
      },
    });

    await req.logActivity({
      category: 'ACCOUNT',
      action: 'USER_EDIT_PROFILE',
      description: `${updatedAgent.email} editted profile`,
      changes: { before: agent, after: updatedAgent },
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

//Dashboard
agentRouter.get(
  '/dashboard',
  isAuth,
  isAgent,
  asyncHandler(async (req, res) => {
    const agentId = req.user?.id;

    if (!agentId) {
      res.status(401).send({ message: 'User not authenticated' });
      return;
    }

    //listings

    const properties = await prisma.property.findMany({
      where: {
        agentId,
      },
    });

    const propertyTotal = await prisma.property.count({
      where: { agentId },
    });
    const listingCounts = await prisma.property.groupBy({
      by: ['listing_type'],
      where: { agentId },
      _count: {
        listing_type: true,
      },
    });
    const listingTypeStats: Record<string, number> = {};
    listingCounts.forEach((item) => {
      listingTypeStats[item.listing_type] = item._count.listing_type;
    });
    const propertyCounts = await prisma.property.groupBy({
      by: ['property_type'],
      where: { agentId },
      _count: {
        property_type: true,
      },
    });
    const propertyTypeStats: Record<string, number> = {};
    propertyCounts.forEach((item) => {
      propertyTypeStats[item.property_type] = item._count.property_type;
    });

    const featuredSlotsCount = await prisma.property.count({
      where: { agentId, is_featured: true },
    });

    const approvalCounts = await prisma.property.groupBy({
      by: ['approval_status'],
      where: { agentId },
      _count: {
        approval_status: true,
      },
    });
    const approvalStats: Record<string, number> = {};
    approvalCounts.forEach((item) => {
      approvalStats[item.approval_status] = item._count.approval_status;
    });

    const statusCounts = await prisma.property.groupBy({
      by: ['status'],
      where: { agentId },
      _count: {
        status: true,
      },
    });
    const statusStats: Record<string, number> = {};
    statusCounts.forEach((item) => {
      statusStats[item.status] = item._count.status;
    });

    const agentReviews = await prisma.agentReview.findMany({
      where: { agentId },
    });
    const propertyReviews = await prisma.propertyReview.findMany({
      where: { property: { agentId } },
      include: { property: true },
      orderBy: { createdAt: 'desc' },
    });
    const activityLog = await prisma.activityLog.findMany({
      where: { userId: agentId },
      orderBy: { createdAt: 'desc' },
    });
    const notifications = await prisma.notification.findMany({
      where: { recipientId: agentId },
      orderBy: { createdAt: 'desc' },
    });
    const leads = await prisma.lead.count({ where: { agentId } });
    const leadsCounts = await prisma.lead.groupBy({
      where: { agentId },
      by: ['status'],
      _count: { status: true },
    });
    const leadsStats: Record<string, number> = {};
    leadsCounts.forEach((item) => {
      leadsStats[item.status] = item._count.status;
    });
    const conversionRate = (leadsStats.closed / leads) * 100 || 0;
    const avgAgentPropertyReviews = await prisma.propertyReview.aggregate({
      where: {
        property: {
          agentId,
        },
      },
      _avg: {
        rating: true,
      },
    });
    const avgAgentReview = await prisma.agentReview.aggregate({
      where: {
        agentId,
      },
      _avg: {
        rating: true,
      },
    });

    const results = await prisma.$queryRaw<
      { month: Date; leads_count: number }[]
    >`
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', NOW()) - interval '5 months',
        date_trunc('month', NOW()),
        interval '1 month'
      ) AS month
    )
    SELECT 
      m.month,
      COALESCE(COUNT(l.id), 0) AS leads_count
    FROM months m
    LEFT JOIN "Lead" l 
      ON date_trunc('month', l."createdAt") = m.month
      AND l."agentId" = ${agentId}
    GROUP BY m.month
    ORDER BY m.month;
  `;

    const leadsByMonths = results.map((r) => ({
      month: r.month.toISOString().slice(0, 7), // "YYYY-MM"
      leads: Number(r.leads_count),
    }));
    res.status(200).json({
      message: 'Dashboard analytics. ',
      listings: {
        total: propertyTotal,
        propertyType: propertyTypeStats,
        listingType: listingTypeStats,
        approvalStatus: approvalStats,
        status: statusStats,
        featured: featuredSlotsCount,
        properties,
      },
      reviews: {
        agentReviews,
        propertyReviews,
        avgAgentPropertyReviews: avgAgentPropertyReviews._avg.rating || 0,
        avgAgentReview: avgAgentReview._avg.rating || 0,
      },
      leads: {
        status: leadsStats,
        conversionRate,
        leadsByMonths,
      },
      activityLog,
      notifications,
    });
  })
);

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
      page = '1',
      limit = '10',
    } = req.query;

    const pageSize = parseInt(limit as string, 10);
    const currentPage = parseInt(page as string, 10);
    const skip = (currentPage - 1) * pageSize;

    const where: any = {
      agentId: agentId,
    };

    // --- UPDATED: Handle comma-separated approvalStatus values ---
    if (approvalStatus) {
      const approvalStatusArray = (approvalStatus as string).split(',');
      if (!approvalStatusArray.includes('all')) {
        where.approval_status = {
          in: approvalStatusArray,
        };
      }
    }

    // --- Original Logic: Handle single listingType value ---
    if (listingType && listingType !== 'all') {
      where.listing_type = listingType as string;
    }

    // --- UPDATED: Handle comma-separated status values ---
    if (status) {
      const statusArray = (status as string).split(',');
      if (!statusArray.includes('all')) {
        where.status = {
          in: statusArray,
        };
      }
    }

    // --- Original Logic: Handle searchTerm ---
    if (searchTerm) {
      where.OR = [
        { title: { contains: searchTerm as string, mode: 'insensitive' } },
        { id: { contains: searchTerm as string, mode: 'insensitive' } },
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
      prisma.property.count({ where }),
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
    const logs = await prisma.activityLog.findMany({
      where: { metadata: { path: ['agent', 'id'], equals: req.user.id } },
    });

    res.json({ property, logs });
  })
);

// Add Listing
agentRouter.post(
  '/properties',
  isAuth,
  isAgent,
  checkListingLimit,
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
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      include: { Subscriptions: true },
    });
    if (!agent) throw new Error('Agent not found');

    const response = await fetch(
      // `https://nominatim.openstreetmap.org/search?city=${req.body.city}&state=${req.body.state}&country=Nigeria&format=json`
      `https://nominatim.openstreetmap.org/search?q=${street},+${city},+${state},+Nigeria&format=json`
    );
    const [data] = await response.json();
    console.log(data);

    const lat = parseFloat(data?.lat);
    const lon = parseFloat(data?.lon);
    const activeSub = await prisma.subscription.findMany({
      where: {
        agentId,
        isActive: true,
      },
      include: { plan: true },
      orderBy: { endDate: 'desc' },
    });

    if (!activeSub.length || !activeSub[0].plan) {
      res.status(403).json({
        message: 'You do not have an active subscription plan.',
      });
    }
    const planName = activeSub[0].plan.name;

    const visibility = TierVisibilityMap[planName as SubscriptionTierType];

    // Then use it in the property creation

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
        visibility,
        agent: { connect: { id: agentId } }, // Link to Agent (User)
      },
    });

    await req.logActivity({
      category: 'USER_ACTION',
      action: 'USER_CREATE_LISTING',
      description: `${agent.email} created a new listing`,
      metadata: {
        property: newProperty,
        agent,
        agentId,
        propertyId: property_type.id,
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
      include: { agent: true },
    });

    await req.logActivity({
      category: 'USER_ACTION',
      action: 'USER_UPDATE_LISTING',
      description: `${updatedProperty.agent?.email} updated listing ${updatedProperty.id}`,
      changes: { before: property, after: updatedProperty },
      metadata: {
        property: updatedProperty,
        agent: updatedProperty.agent,
        agentId,
        propertyId,
      },
    });
    //TODO NOTIFY FOR APPROVAL

    res.json(updatedProperty);
  })
);

agentRouter.put(
  '/featured',
  isAuth,
  isAgent,
  asyncHandler(async (req, res) => {
    const { properties = [] } = req.body;
    const agentId = req.user.id;
    console.log(properties);

    if (!Array.isArray(properties)) {
      res.status(400).json({ message: 'Invalid propertyIds format.' });
    }

    // 1. Get the agent and their subscription tier
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      include: {
        Subscriptions: true, // or however your schema links subscription tier
      },
    });
    const activeSub = await prisma.subscription.findMany({
      where: {
        agentId: agent?.id,
        isActive: true,
      },
      include: { plan: true },
      orderBy: { endDate: 'desc' },
    });

    if (!activeSub.length || !activeSub[0].plan) {
      console.log('No active plan');
    }
    const planName = activeSub[0].plan.name;

    const tier: SubscriptionTierType = planName || 'basic';
    const featureLimit = TierFeatureLimits[tier].featuredSlots;

    if (properties.length > featureLimit) {
      res.status(400).json({
        message: `You can only feature up to ${featureLimit} properties on the ${tier} tier.`,
      });
    }

    // 2. Find current featured properties for this agent
    const currentFeatured = await prisma.property.findMany({
      where: {
        agentId,
        is_featured: true,
      },
      select: { id: true },
    });

    const currentIds = currentFeatured.map((p) => p.id);

    const toUnfeature = currentIds.filter((id) => !properties.includes(id));
    const toFeature = properties;

    // 3. Run transaction
    await prisma.$transaction([
      prisma.property.updateMany({
        where: { id: { in: toUnfeature }, agentId },
        data: { is_featured: false },
      }),
      prisma.property.updateMany({
        where: { id: { in: toFeature }, agentId },
        data: { is_featured: true },
      }),
    ]);
    await req.logActivity({
      category: 'ACCOUNT',
      action: 'USER_UPDATE_FEATURED',
      description: `${agent?.email} updated featured list`,
      metadata: { agent },
    });
    res.status(200).json({
      message: `Featured properties updated. ${toFeature.length} set to featured, ${toUnfeature.length} unfeatured.`,
    });
  })
);

// Get all subscriptions
agentRouter.get(
  '/subscriptions',
  isAuth,
  isAgent,
  asyncHandler(async (req, res) => {
    const agentId = (req as AuthRequest).user?.id;
    if (!agentId) {
      res.status(401).send({ message: 'User not authenticated' });
      return;
    }
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.limit as string) || 10;
    const allSubscriptions = await prisma.subscription.findMany({
      where: { agentId },
      include: {
        plan: true,
      },
    });
    const activeSub = allSubscriptions.find((sub) => sub.isActive);

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where: { agentId },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          plan: { include: { SubscriptionPlan: true } }, // include tier info as well
        },
      }),

      prisma.subscription.count({
        where: { agentId },
      }),
    ]);

    res.json({
      subscriptions,
      page,
      limit: pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / pageSize),
      activeSub,
    });
  })
);

// cancel subscription
agentRouter.post(
  '/subscriptions/cancel',
  isAuth,
  isAgent,
  asyncHandler(async (req, res) => {
    const agentId = req.user?.id;

    if (!agentId) {
      res.status(401).send({ message: 'User not authenticated' });
      return;
    }

    const agent = await prisma.user.findUnique({ where: { id: agentId } });
    const subscription = await prisma.subscription.findFirst({
      where: { isActive: true, agentId },
      include: { plan: { include: { SubscriptionPlan: true } } },
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
    // const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const newSubscription = await prisma.subscription.create({
      data: {
        isActive: true,
        planId: planId,
        agentId: agentId,
        startDate: now,
        // endDate: endDate,
        // nextPaymentDate: endDate,
      },
    });
    await req.logActivity({
      category: 'USER_ACTION',
      action: 'USER_CANCEL_SUBSCRIPTION',
      description: `${agent?.email} cancelled ${subscription.plan.name} subscription`,
      metadata: { agent, subscription },
    });
    res.status(200).json({
      message: 'Subscription cancelled, reset to basic.',
      data: newSubscription,
    });
  })
);

//payments

agentRouter.post(
  '/payments/initialize',
  isAuth,
  asyncHandler(async (req, res) => {
    const { tierId, email, reference, billingPeriod } = req.body;
    const userId = req.user.id;

    // Find the subscription plan by tierId
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { tierId, duration: billingPeriod },
      include: { tier: true },
    });

    if (!plan) {
      res.status(404).json({ message: 'Subscription plan not found' });
      return;
    }

    // Validate reference sent from frontend
    if (!reference || typeof reference !== 'string') {
      res.status(400).json({ message: 'Invalid reference' });
      return;
    }

    try {
      // Create a pending payment in your DB
      await prisma.payment.create({
        data: {
          userId,
          reference,
          amount: plan.price, // store amount for record
          provider: 'PAYSTACK',
          purpose: 'SUBSCRIPTION',
          status: 'PENDING',
        },
      });

      // Create subscription on Paystack
      const response = await paystack.post('/transaction/initialize', {
        email,
        amount: plan.price * 100, // kobo
        reference,
        plan: plan.paystackPlanCode,
        metadata: {
          userId,
          planId: plan.id, // <-- your internal plan ID here
        },
        callback_url: 'http://localhost:3001/subscriptions',
      });
      console.log(response.data);

      // Return the subscription data to frontend (e.g. subscription_code)
      res.json({
        authorization_url: response.data.data.authorization_url,
        // subscription_code: response.data.data.subscription_code,
        // message: 'Subscription created successfully',
      });
    } catch (error: any) {
      console.error(
        'Paystack subscription creation failed:',
        error.response?.data || error.message
      );
      res.status(400).json({
        message: 'Subscription initialization failed',
        detail: error.response?.data || error.message,
      });
    }
  })
);

agentRouter.post(
  '/payments/paystack/verify',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req, res) => {
    // const secret = process.env.PAYSTACK_SECRET_KEY!;
    // const hash = crypto
    //   .createHmac('sha512', secret)
    //   .update(req.body)
    //   .digest('hex');

    // if (hash !== req.headers['x-paystack-signature']) {
    //   console.log('Invalid webhook signature');
    //   res.status(401).send('Unauthorized');
    //   return;
    // }

    const event = req.body;

    console.log('Paystack Event Received:', event);
    const eventData = event?.data;

    switch (event.event) {
      case 'charge.success': {
        if (!eventData || !eventData.reference) {
          console.error(
            'charge.success webhook: Missing event data or reference.'
          );
          res.status(400).send('Bad Request');
          return;
        }

        const reference = eventData.reference;
        const amountInKobo = eventData.amount;
        const amount = amountInKobo / 100;
        const subscriptionCode = eventData.subscription?.subscription_code;
        const customerCode = eventData.customer?.customer_code;

        let user = null;
        const userIdFromMetadata = eventData.metadata?.userId;
        const customerEmail = eventData.customer?.email;

        if (userIdFromMetadata) {
          user = await prisma.user.findUnique({
            where: { id: userIdFromMetadata },
          });
        } else if (customerEmail) {
          user = await prisma.user.findUnique({
            where: { email: customerEmail },
          });
        }

        if (!user) {
          console.error(
            'charge.success webhook: Could not find user from metadata or customer email.'
          );
          res.status(404).send('Not Found');
          return;
        }

        // Find or create the PaystackCustomer record. This is a good practice to
        // link Paystack's customer to your User.
        if (customerCode) {
          await prisma.paystackCustomer.upsert({
            where: { customerCode: customerCode },
            update: { userId: user.id },
            create: { customerCode: customerCode, userId: user.id },
          });
        }

        // Find the pending payment record using the unique reference.
        const pendingPayment = await prisma.payment.findUnique({
          where: { reference: reference },
        });

        // Use `create` for idempotency if no payment record exists.
        if (pendingPayment) {
          // Update the existing pending payment record.
          await prisma.payment.update({
            where: { id: pendingPayment.id },
            data: {
              status: 'SUCCESS',
              amount: amount,
              // For recurring payments, the subscriptionCode will be present.
              // For initial payments, it will be null, and we'll link it later.
              ...(subscriptionCode && {
                subscription: {
                  connect: { paystackSubscriptionCode: subscriptionCode },
                },
              }),
            },
          });
          await req.logActivity({
            category: 'SYSTEM',
            action: 'PAYMENT_SUCCESSFUL',
            description: `${user?.email} Payment successfull.`,
            metadata: { agent: user, pendingPayment },
          });
        } else {
          // If no pending payment exists (e.g., for recurring charges), create one.
          const payment = await prisma.payment.create({
            data: {
              userId: user.id,
              reference: reference,
              amount: amount,
              currency: 'NGN',
              status: 'SUCCESS',
              purpose: 'SUBSCRIPTION',
              provider: 'PAYSTACK',
              ...(subscriptionCode && {
                subscription: {
                  connect: { paystackSubscriptionCode: subscriptionCode },
                },
              }),
            },
          });
          await req.logActivity({
            category: 'SYSTEM',
            action: 'PAYMENT_SUCCESSFUL',
            description: `${user?.email} Payment successfull.`,
            metadata: { agent: user, payment },
          });
        }

        // =========================================================================
        // UPDATED LOGIC: Extend subscription dates for recurring payments.
        // This is now more robust to handle cases where subscription_code is missing.
        // =========================================================================
        let subscriptionToUpdate = null;

        if (subscriptionCode) {
          // If subscription_code is available, use it directly.
          subscriptionToUpdate = await prisma.subscription.findUnique({
            where: { paystackSubscriptionCode: subscriptionCode },
            include: { plan: { include: { SubscriptionPlan: true } } },
          });
        } else if (customerCode && eventData.plan?.plan_code) {
          // If subscription_code is not available (as in your provided renewal event),
          // find the active subscription using the customer code and plan code.
          const paystackCustomer = await prisma.paystackCustomer.findUnique({
            where: { customerCode: customerCode },
          });

          if (paystackCustomer?.userId) {
            subscriptionToUpdate = await prisma.subscription.findFirst({
              where: {
                agentId: paystackCustomer.userId,
                paystackPlanCode: eventData.plan.plan_code,
                isActive: true,
              },
              include: { plan: true },
            });
          }
        }

        if (subscriptionToUpdate) {
          const subscriptionPlan = await prisma.subscriptionPlan.findFirst({
            where: {
              tierId: subscriptionToUpdate.planId,
              paystackPlanCode: subscriptionToUpdate.paystackPlanCode,
            },
          });

          if (subscriptionPlan) {
            const newEndDate = calculateNewEndDate(
              subscriptionToUpdate.endDate ?? new Date(), //TODO MAKE SURE THIS ISNT A PROBLEM
              subscriptionPlan.duration
            );
            const newNextPaymentDate = newEndDate;

            const subscription = await prisma.subscription.update({
              where: { id: subscriptionToUpdate.id },
              data: {
                isActive: true,
                endDate: newEndDate,
                nextPaymentDate: newNextPaymentDate,
              },
            });
            await req.logActivity({
              category: 'SYSTEM',
              action: 'USER_RENEW_SUBSCRIPTION',
              description: `${user?.email} renewed subscription.`,
              metadata: { subscription, agent: user },
            });
          } else {
            console.error(
              'charge.success webhook: Could not find subscription plan in DB for recurring charge.'
            );
          }
        }
        break;
      }

      case 'subscription.create': {
        const data = eventData;
        const subscriptionCode = data.subscription_code;
        const paystackPlanCode = data.plan?.plan_code;
        const customerCode = data.customer?.customer_code;
        const nextPaymentDate = data.next_payment_date;
        const emailToken = data.email_token;
        const customerEmail = data.customer?.email;

        if (
          !subscriptionCode ||
          !paystackPlanCode ||
          !customerCode ||
          !customerEmail
        ) {
          console.error('subscription.create webhook: Missing essential data.');
          res.status(400).send('Bad Request');
          return;
        }

        // Find the user and plan to link the new subscription.
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { PaystackCustomer: { customerCode } },
              { email: customerEmail },
            ],
          },
          include: { PaystackCustomer: true },
        });

        // The logic for linking the paystack customer record to the user is
        // primarily handled in the `charge.success` event, which is the most
        // reliable place for it. This check here is a fallback.
        if (user && !user.PaystackCustomer) {
          await prisma.paystackCustomer.create({
            data: { customerCode: customerCode, userId: user.id },
          });
        }

        const subscriptionPlan = await prisma.subscriptionPlan.findFirst({
          where: { paystackPlanCode: paystackPlanCode },
        });

        if (!user || !subscriptionPlan) {
          console.error(
            'subscription.create webhook: Could not find user or plan in DB.'
          );
          res.status(404).send('Not Found');
          return;
        }

        // =========================================================================
        // REFINED LOGIC: Disable all existing active subscriptions on Paystack
        // and in the DB to prevent conflicts.
        // =========================================================================
        const oldSubscriptions = await prisma.subscription.findMany({
          where: { agentId: user.id, isActive: true },
        });

        for (const oldSub of oldSubscriptions) {
          // Disable on Paystack
          if (oldSub.paystackSubscriptionCode && oldSub.paystackEmailToken) {
            try {
              await paystack.post('/subscription/disable', {
                code: oldSub.paystackSubscriptionCode,
                token: oldSub.paystackEmailToken,
              });
              console.log(
                `Disabled Paystack subscription: ${oldSub.paystackSubscriptionCode}`
              );
            } catch (err: any) {
              console.error(
                `Failed to disable Paystack subscription: ${oldSub.paystackSubscriptionCode}`,
                err.response?.data || err.message
              );
            }
          }
          // Mark as inactive in local DB
          await prisma.subscription.update({
            where: { id: oldSub.id },
            data: { isActive: false },
          });
        }

        // Create the new subscription record.
        const newSubscription = await prisma.subscription.create({
          data: {
            agentId: user.id,
            planId: subscriptionPlan.tierId,
            startDate: new Date(),
            endDate: nextPaymentDate ? new Date(nextPaymentDate) : '',
            paystackPlanCode: paystackPlanCode,
            paystackSubscriptionCode: subscriptionCode,
            paystackCustomerCode: customerCode,
            paystackEmailToken: emailToken,
            nextPaymentDate: nextPaymentDate ? new Date(nextPaymentDate) : null,
            isActive: true,
            manuallyGranted: false,
          },
        });
        await req.logActivity({
          category: 'USER_ACTION',
          action: 'USER_CREATE_SUBSCRIPTION',
          description: `${user?.email} created a new subscription.`,
          metadata: { subscription: newSubscription, agent: user },
        });
        // Link the most recent successful payment to this subscription.
        const recentPayment = await prisma.payment.findFirst({
          where: {
            userId: user.id,
            status: 'SUCCESS',
            purpose: 'SUBSCRIPTION',
            subscriptionId: null,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (recentPayment) {
          await prisma.payment.update({
            where: { id: recentPayment.id },
            data: {
              subscriptionId: newSubscription.id,
            },
          });
        }
        break;
      }

      // =========================================================================
      // CASE: invoice.payment_failed
      // This event is triggered when a recurring payment attempt fails.
      // We will now implement a grace period before fully disabling the subscription.
      // =========================================================================
      case 'invoice.payment_failed': {
        const subscriptionCode = eventData.subscription?.subscription_code;
        const amountInKobo = eventData.amount;
        const amount = amountInKobo / 100;
        const customerEmail = eventData.customer?.email;

        if (!subscriptionCode) {
          console.error(
            'invoice.payment_failed webhook: Missing subscription code.'
          );
          res.status(400).send('Bad Request');
          return;
        }

        const subscription = await prisma.subscription.findUnique({
          where: { paystackSubscriptionCode: subscriptionCode },
          include: { plan: true },
        });

        const user = await prisma.user.findUnique({
          where: { email: customerEmail },
        });

        const reference = `sub_${subscription?.plan.name}_${getBillingPeriod(
          subscription?.startDate.toString() || '',
          subscription?.endDate?.toString() || ''
        )}_${Date.now()}_${user?.id}`;

        if (subscription && user) {
          // The subscription payment has failed. Instead of immediately
          // disabling the subscription, we will put it into a grace period.
          // This date can be used by a separate background job to eventually
          // disable the subscription in the database.
          const gracePeriodInDays = 7; // This can be configurable via your plan model.
          const gracePeriodEndDate = addDays(new Date(), gracePeriodInDays);

          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              gracePeriodEndDate: gracePeriodEndDate,
              // We'll keep isActive: true during the grace period. A background
              // job will check `gracePeriodEndDate` to set it to false.
            },
          });

          // Log the failed payment attempt
          const payment = await prisma.payment.create({
            data: {
              userId: user.id,
              subscriptionId: subscription.id,
              amount: amount,
              provider: 'PAYSTACK',
              reference: reference,
              purpose: 'SUBSCRIPTION',
              status: 'FAILED',
            },
          });
          await req.logActivity({
            category: 'SYSTEM',
            action: 'PAYMENT_FAILED',
            description: `${user?.email} Payment failed.`,
            metadata: { payment, agent: user },
          });
          // TODO: Add logic here to notify the user of the failed payment
          // and the start of the grace period. This could be an email,
          // an in-app notification, or a push notification.
          sendEmailNotificationToSingleUser({
            title: 'Payment Failed',
            message: `Payment failed for user ${user.id}. Grace period started, ends on ${gracePeriodEndDate}.`,
            email: user.email,
            recipientId: user.id,
          });
          console.log(
            `Payment failed for user ${user.id}. Grace period started, ends on ${gracePeriodEndDate}.`
          );
        } else {
          // If the payment failed but we couldn't find a corresponding subscription,
          // we'll still log the payment attempt if we have the user.
          if (user) {
            await prisma.payment.create({
              data: {
                userId: user.id,
                amount: amount,
                provider: 'PAYSTACK',
                reference: reference,
                purpose: 'SUBSCRIPTION',
                status: 'FAILED',
              },
            });
          }
          console.error(
            `invoice.payment_failed: Could not find user or subscription for code ${subscriptionCode}`
          );
        }
        break;
      }

      // =========================================================================
      // CASE: subscription.not_renew
      // This event indicates that Paystack will not attempt to renew the subscription.
      // The subscription should remain active until its end date.
      // =========================================================================
      case 'subscription.not_renew': {
        const subscriptionCode = eventData?.subscription_code;
        const customerEmail = eventData.customer?.email;

        if (!subscriptionCode) {
          console.error(
            'subscription.not_renew webhook: Missing subscription code.'
          );
          res.status(400).send('Bad Request');
          return;
        }

        const user = await prisma.user.findUnique({
          where: { email: customerEmail },
        });

        // The subscription remains active until its end date passes.
        // A background job will handle the deactivation and downgrade.
        // We will just notify the user here.
        console.log(
          `Subscription ${subscriptionCode} for user ${user?.id} will not be renewed by Paystack.`
        );

        // TODO: Send a message or email to the user notifying them that their
        // subscription will not be renewed and will expire on its end date.

        break;
      }

      // =========================================================================
      // CASE: subscription.disable
      // This event is sent when a subscription is explicitly disabled.
      // We will immediately mark it as inactive and downgrade the user.
      // =========================================================================
      case 'subscription.disable': {
        const subscriptionCode = eventData?.subscription_code;
        const customerEmail = eventData.customer?.email;

        if (!subscriptionCode) {
          console.error(
            'subscription.disable webhook: Missing subscription code.'
          );
          res.status(400).send('Bad Request');
          return;
        }

        const subscription = await prisma.subscription.findUnique({
          where: { paystackSubscriptionCode: subscriptionCode },
          include: { plan: true },
        });

        const user = await prisma.user.findUnique({
          where: { email: customerEmail },
        });

        if (subscription && user) {
          // Find the basic plan to assign to the user.
          // NOTE: This assumes you have a plan in your database named 'Basic Tier'.
          const basicPlan = await prisma.subscriptionPlan.findFirst({
            where: { tier: { name: 'basic' } },
          });

          if (!basicPlan) {
            console.error('Basic Tier plan not found. Cannot downgrade user.');
            res.status(500).send('Internal Server Error');
            return;
          }

          // Mark the current subscription as inactive immediately.
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { isActive: false },
          });
          console.log(
            `Subscription ${subscription.id} for user ${user.id} has been disabled.`
          );
          await req.logActivity({
            category: 'USER_ACTION',
            action: 'USER_CANCEL_SUBSCRIPTION',
            description: `${user?.email} cancelled ${subscription.plan.name} subscription`,
            metadata: { subscription, agent: user },
          });

          // Create a new basic subscription for the user.
          const newSubscription = await prisma.subscription.create({
            data: {
              agentId: user.id,
              planId: basicPlan.tierId,
              paystackPlanCode: null,
              paystackSubscriptionCode: null,
              paystackCustomerCode: null,
              paystackEmailToken: null,
              startDate: new Date(),
              endDate: null,
              nextPaymentDate: null,
              isActive: true,
              manuallyGranted: true,
            },
          });
          console.log(`User ${user.id} has been downgraded to the Basic Tier.`);

          // TODO: Send an email to the user notifying them of the change.
        } else {
          console.error(
            `subscription.disable webhook: Could not find user or subscription for code ${subscriptionCode}`
          );
        }

        break;
      }

      default:
        console.log('Unhandled event type:', event.event);
        break;
    }

    res.sendStatus(200);
  })
);

//get payments
agentRouter.get(
  '/payments',
  isAuth,
  isAgent,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.limit as string) || 10;
    if (!userId) {
      res.status(401).send({ message: 'User not authenticated' });
      return;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          subscription: { include: { plan: true } },
          user: true,
        },
      }),

      prisma.payment.count({
        where: { userId },
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

export default agentRouter;
