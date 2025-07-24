import express, { NextFunction } from 'express';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient, SubscriptionTierType, UserRole } from '@prisma/client';
import asyncHandler from 'express-async-handler';
import { AuthRequest, generateToken, isAgent, isAuth } from '../utils/auth';
import {
  TierFeatureLimits,
  TierVisibilityMap,
} from '../utils/visibilityConfig';
import { checkListingLimit } from '../middleware/checkListingLimit';
import * as crypto from 'crypto';

import paystack from '../utils/paystack';
import { getBillingPeriod } from '../utils/data';

const prisma = new PrismaClient();

const agentRouter = express.Router();

// Agent Routes

agentRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const {
      name,
      email,
      phone_number,
      logo,
      password,
      verification_docs,
      bio,
      address,
      socials,
    } = req.body as {
      name: string;
      email: string;
      phone_number: string;
      logo: string;
      password: string;
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

    const response = await fetch(
      // `https://nominatim.openstreetmap.org/search?city=${req.body.city}&state=${req.body.state}&country=Nigeria&format=json`
      `https://nominatim.openstreetmap.org/search?q=${address?.street},+${address?.city},+${address?.state},+Nigeria&format=json`
    );
    const [data] = await response.json();
    console.log(data);

    const lat = parseFloat(data?.lat);
    const lon = parseFloat(data?.lon);
    const updatedAddress = { ...address, lat, lon };

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
        socials,
        address: updatedAddress,
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
        subscriptionTier: 'basic',
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
    const subscription = await prisma.subscription.findFirst({
      where: { isActive: true, agentId },
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
        agentId: agentId,
        startDate: now,
        endDate: endDate,
        nextPaymentDate: endDate,
      },
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

    switch (event.event) {
      case 'charge.success': {
        const data = event.data;
        const reference = data.reference;
        const userId = data.metadata?.userId;
        const planId = data.metadata?.planId;
        const customerCode = data.customer?.customer_code;

        if (userId && customerCode) {
          const userExists = await prisma.user.findUnique({
            where: { id: userId },
          });

          if (userExists) {
            await prisma.paystackCustomer.upsert({
              where: { userId },
              update: { customerCode },
              create: { userId, customerCode },
            });
          } else {
            console.log(`User with ID ${userId} does not exist.`);
          }
        }

        const subscription = await prisma.subscription.findFirst({
          where: {
            agentId: userId,
            isActive: true,
          },
          orderBy: { startDate: 'desc' },
        });

        if (subscription) {
          const now = new Date();

          // Get plan details to determine duration
          const plan = await prisma.subscriptionPlan.findFirst({
            where: { tierId: planId },
          });

          let durationInDays = 30; // Default to monthly
          if (plan?.duration === 'YEARLY') durationInDays = 365;

          const endDate = new Date(
            now.getTime() + durationInDays * 24 * 60 * 60 * 1000
          );

          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              startDate: now,
              endDate,
              nextPaymentDate: endDate,
              isActive: true,
            },
          });
        } else {
          console.log('No active subscription found for user:', userId);
        }

        const payment = await prisma.payment.findUnique({
          where: { reference },
        });

        if (payment && payment.status === 'PENDING') {
          await prisma.payment.update({
            where: { reference },
            data: {
              status: 'SUCCESS',
              subscriptionId: subscription?.id ?? null,
            },
          });
        }

        break;
      }

      case 'subscription.create': {
        const data = event.data;
        const customerCode = data.customer?.customer_code;
        const planCode = data.plan?.plan_code;
        const subscriptionCode = data.subscription_code;
        const nextPaymentDate = data.next_payment_date;
        const paystackEmailToken = data.email_token;

        if (!customerCode || !planCode || !subscriptionCode) {
          console.log('Missing data in subscription.create webhook');
          break;
        }

        const customer = await prisma.paystackCustomer.findUnique({
          where: { customerCode },
        });

        if (!customer) {
          console.log(
            'No matching user found for customer code:',
            customerCode
          );
          break;
        }

        const userId = customer.userId;

        const internalPlan = await prisma.subscriptionPlan.findFirst({
          where: { paystackPlanCode: planCode },
        });

        if (!internalPlan) {
          console.log('No matching plan found for plan code:', planCode);
          break;
        }

        // 1. Create the new subscription
        const newSubscription = await prisma.subscription.create({
          data: {
            agentId: userId,
            planId: internalPlan.tierId,
            startDate: new Date(),
            endDate: new Date(nextPaymentDate),
            paystackSubscriptionCode: subscriptionCode,
            paystackPlanCode: planCode,
            nextPaymentDate: new Date(nextPaymentDate),
            isActive: true,
            paystackEmailToken,
          },
        });

        // 2. Find older active subscriptions for this user (excluding the new one)
        const oldSubscriptions = await prisma.subscription.findMany({
          where: {
            agentId: userId,
            id: { not: newSubscription.id },
            isActive: true,
            // paystackSubscriptionCode: { not: null },
          },
        });

        // 3. Cancel each old subscription on Paystack + mark inactive in DB
        for (const oldSub of oldSubscriptions) {
          try {
            console.log(
              'Trying to cancel Paystack subscription:',
              oldSub.paystackSubscriptionCode
            );

            await paystack.post(
              `/subscription/disable`,
              {
                code: `${oldSub.paystackSubscriptionCode}`,
                token: `${oldSub.paystackEmailToken}`,
              }
              // `/subscription/${oldSub.paystackSubscriptionCode}/disable`
            );
            console.log(
              `Cancelled Paystack subscription: ${oldSub.paystackSubscriptionCode}`
            );
          } catch (err: any) {
            console.error(
              `Failed to cancel Paystack subscription: ${oldSub.paystackSubscriptionCode}`,
              err.response?.data || err.message
            );
          }

          await prisma.subscription.update({
            where: { id: oldSub.id },
            data: { isActive: false },
          });
        }

        // Find the most recent pending payment by user and plan (optional add time filter)
        const payment = await prisma.payment.findFirst({
          where: {
            userId,
            // status: 'PENDING',
            // purpose: 'SUBSCRIPTION',
            // provider: 'PAYSTACK',
          },
          orderBy: { createdAt: 'desc' },
        });
        // console.log('payment: ', payment);

        if (payment) {
          console.log('Yes, payment exists');
          await prisma.payment.update({
            where: { id: payment.id },
            data: { subscriptionId: newSubscription.id },
          });
        } else {
          console.log('No payment found to link to this subscription');
        }
        break;
      }

      case 'invoice.payment_failed': {
        const subscriptionCode = event.data.subscription?.subscription_code;
        if (subscriptionCode) {
          await prisma.subscription.updateMany({
            where: { paystackSubscriptionCode: subscriptionCode },
            data: { isActive: false },
          });

          // TODO Optionally: notify user by email
        }
        const email = event.data.customer?.sendEmailNotificationToSingleUser;
        if (email) {
          const agent = await prisma.user.findUnique({
            where: { email },
          });
          if (!agent) {
            console.error('No agent matches customer');
            return;
          }
          const subscription = await prisma.subscription.findFirst({
            where: {
              paystackSubscriptionCode: subscriptionCode,
              agentId: agent.id,
            },
            orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
            include: { plan: { include: {} } },
          });
          const reference = `sub_${subscription?.plan.name}_${getBillingPeriod(
            subscription?.startDate.toString() || '',
            subscription?.endDate.toString() || ''
          )}_${Date.now()}_${agent.id}`;
          const payment = await prisma.payment.create({
            data: {
              userId: agent.id,
              reference,
              amount: event.data.subscription?.amount, // store amount for record
              provider: 'PAYSTACK',
              purpose: 'SUBSCRIPTION',
              status: 'FAILED',
            },
          });
        }
        break;
      }

      case 'invoice.payment_successful': {
        const subscriptionCode = event.data.subscription?.subscription_code;
        const amount = event.data.amount / 100;
        const reference = event.data.reference;

        const subscription = await prisma.subscription.findFirst({
          where: { paystackSubscriptionCode: subscriptionCode },
        });

        if (subscription) {
          await prisma.payment.create({
            data: {
              userId: subscription.agentId,
              subscriptionId: subscription.id,
              amount,
              provider: 'PAYSTACK',
              reference,
              purpose: 'SUBSCRIPTION',
              status: 'SUCCESS',
            },
          });

          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              nextPaymentDate: new Date(event.data.next_payment_date),
              isActive: true,
            },
          });
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
