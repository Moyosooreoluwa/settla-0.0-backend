import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import asyncHandler from 'express-async-handler';
import { generateToken, isAuth } from '../utils/auth';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const userRouter = express.Router();

//Google Auth
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID!);

//TODO - FIX CONTROLLERS, VERIFY EMAIL, SOFT DELETE

userRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { name, email, password, phone_number } = req.body;

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
        role: 'buyer',
      },
    });

    const token = generateToken({ id: newUser.id, role: newUser.role });

    res.status(201).json({
      message: 'User registered successfully',
      isSignedIn: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone_number: newUser.phone_number,
        role: newUser.role,
      },
      token,
    });
  })
);

// Signin Route
userRouter.post(
  '/signin',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        saved_searches: { select: { id: true } },
        saved_properties: {
          select: { id: true },
        },
      },
    });
    if (!user) {
      res.status(400).send({ message: 'Invalid email or password' });
      return; // Added return to stop execution
    }
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(400).send({ message: 'Invalid email or password' });
      return; // Added return to stop execution
    }

    const token = generateToken({ id: user.id, role: user.role });
    const savedPropertyIds = user.saved_properties.map((prop) => prop.id);
    const savedSearchesIds = user.saved_searches.map((search) => search.id);
    res.status(200).json({
      message: 'Signin successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone_number: user.phone_number,
        saved_properties: savedPropertyIds,
        saved_searches: savedSearchesIds,
      },
      token,
      isSignedIn: true,
    });
  })
);

//Google Auth
userRouter.post(
  '/google',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ message: 'No token provided' });
      return;
    }

    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      if (!payload || !payload.email) {
        res.status(400).json({ message: 'Invalid Google token payload' });
        return;
      }

      const { email, name, sub, picture } = payload;

      let user = await prisma.user.findUnique({
        where: { email },
        include: {
          saved_properties: { select: { id: true } },
          saved_searches: { select: { id: true } },
        },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name: name || 'Google User',
            password_hash: sub,
            role: 'buyer',
          },
          include: {
            saved_properties: { select: { id: true } },
            saved_searches: { select: { id: true } },
          },
        });
      }

      const authToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET as string,
        { expiresIn: '7d' }
      );

      const savedPropertyIds = user.saved_properties.map((prop) => prop.id);
      const savedSearchesIds = user.saved_searches.map((search) => search.id);

      res.status(200).json({
        message: 'Signin successful',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone_number: user.phone_number,
          savedSearchesIds,
          savedPropertyIds,
        },
        token: authToken,
        isSignedIn: true,
      });
    } catch (error: any) {
      console.error('Google Auth Error:', error);
      res.status(500).json({ message: 'Google Authentication failed' });
    }
  })
);

//Edit Profile
userRouter.put(
  '/profile',
  isAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;

    const { name, email, phone_number, password } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      res.status(404).send({ message: 'User not found' });
      return;
    }

    // Update only if provided
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name || user.name,
        email: email || user.email,
        phone_number: phone_number || user.phone_number,
        password_hash: password
          ? bcrypt.hashSync(password, 8)
          : user.password_hash,
      },
    });

    res.json({
      message: 'Profile updated successfully',
      isSignedIn: true,
      token: generateToken({ id: updatedUser.id, role: updatedUser.role }),
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone_number: updatedUser.phone_number,
        role: updatedUser.role,
      },
    });
  })
);

//Delete User
userRouter.delete(
  '/me',
  isAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).send({ message: 'Not authorized' }); // Changed to .send and added return
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      res.status(404).send({ message: 'User not found' }); // Changed to .send and added return
      return;
    }

    await prisma.user.delete({ where: { id: userId } });

    res.status(200).json({ message: 'Your account has been deleted.' });
  })
);

// Save a property
userRouter.post(
  '/save-property/:id',
  isAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;

    const property = await prisma.property.findUnique({
      where: { id: id },
    });

    if (!property) {
      res.status(404).send({ message: 'Property not found' }); // Changed to .send and added return
      return;
    }
    await prisma.user.update({
      where: { id: userId },
      data: {
        saved_properties: {
          connect: { id: id },
        },
      },
    });

    res.status(200).json({ message: 'Property added to saved!' });
  })
);

// Unsave property
userRouter.delete(
  '/unsave-property/:id',
  isAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;

    await prisma.user.update({
      where: { id: userId },
      data: {
        saved_properties: {
          disconnect: { id },
        },
      },
    });

    res.status(200).json({ message: 'Property removed from saved list.' });
  })
);

// Get saved Properties
userRouter.get(
  '/saved-properties',
  isAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).send({ message: 'User not authenticated' });
    }

    const userWithSaved = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        saved_properties: {},
      },
    });

    if (!userWithSaved) {
      res.status(404).send({ message: 'User not found' });
    }

    res.json(userWithSaved?.saved_properties);
  })
);

// save a search
userRouter.post(
  '/save-search',
  isAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { query, sendAlerts } = req.body;

    if (!query || typeof query !== 'object') {
      res
        .status(400)
        .json({ message: 'Query is required and must be an object' });
    }

    const savedSearch = await prisma.savedSearch.create({
      data: {
        userId,
        query,
        sendAlerts: sendAlerts || false,
      },
    });

    res.status(201).json(savedSearch);
  })
);

// unsave a search
userRouter.delete(
  '/unsave-search/',
  isAuth,
  asyncHandler(async (req, res) => {
    const { query } = req.body;
    console.log(query);

    const deleted = await prisma.savedSearch.deleteMany({
      where: {
        query: {
          equals: query, // full deep match
        },
      },
    });

    res.json(deleted);
  })
);

// toggle alert
userRouter.put(
  '/alert-toggle',
  isAuth,
  asyncHandler(async (req, res) => {
    const { id, sendAlerts } = req.body;

    const search = await prisma.savedSearch.update({
      where: { id },
      data: { sendAlerts },
    });

    res.status(200).json(search);
  })
);

// Get saved searches by IDs
userRouter.get(
  '/searches/by-ids',
  isAuth,
  asyncHandler(async (req, res) => {
    let ids: string[] = [];

    if (typeof req.query.ids === 'string') {
      ids = req.query.ids.split(',');
    } else if (Array.isArray(req.query.ids)) {
      ids = req.query.ids.flatMap((id) =>
        typeof id === 'string' ? id.split(',') : []
      );
    }

    const searches = await prisma.savedSearch.findMany({
      where: { id: { in: ids } },
    });

    res.json(searches);
  })
);

// Get Leads
userRouter.get(
  '/my-enquiries',
  isAuth,
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = (page - 1) * limit;
    if (!req.user.id) {
      res.status(401).send({ message: 'User not authenticated' });
    }
    const [leads, totalItems] = await prisma.$transaction([
      prisma.lead.findMany({
        orderBy: { createdAt: 'desc' },
        where: { userId: req.user.id },
        include: { property: true, agent: true },
      }),
      prisma.lead.count({ where: { userId: req.user.id } }),
    ]);
    const pages = Math.ceil(totalItems / limit);

    res.json({ leads, totalItems, page, pages });
  })
);

//Get all agents
userRouter.get(
  '/agents',
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    // TODO change default limit
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = (page - 1) * limit;

    const where = { role: 'agent' as const };

    const [agents, totalItems] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          properties: true, // Include their listed properties
        },
      }),
      prisma.user.count({ where }),
    ]);

    const pages = Math.ceil(totalItems / limit);

    res.json({ agents, totalItems, page, pages });
  })
);

// Get Notifications
userRouter.get(
  '/my-notifications',
  isAuth,
  asyncHandler(async (req, res) => {
    if (!req.user.id) {
      res.status(401).send({ message: 'User not authenticated' });
    }
    const notifications = await prisma.notification.findMany({
      where: { recipientId: req.user.id, type: 'IN_APP' },
      orderBy: { createdAt: 'desc' },
    });
    res.json(notifications);
  })
);
userRouter.put(
  '/my-notifications/read',
  isAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.body;

    const notification = await prisma.notification.findUnique({
      where: { id, type: 'IN_APP' },
    });

    if (!notification) {
      res.status(404).send({ message: 'Notification not found' });
      return;
    }

    // Update only if provided
    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
      },
    });
    res.json(updatedNotification);
  })
);

export default userRouter;
