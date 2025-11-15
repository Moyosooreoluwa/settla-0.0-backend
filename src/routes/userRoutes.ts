import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import asyncHandler from 'express-async-handler';
import { generateToken, isAuth } from '../middleware/auth';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { generate2FACode, generateSearchName } from '../utils/data';
import { nanoid } from 'nanoid';
import {
  send2FACodeEmail,
  sendPasswordChangedEmail,
  sendResetPasswordEmail,
  sendVerificationEmail,
} from '../utils/utils';
import crypto from 'crypto';
import { authRateLimiterMiddleware } from '../utils/AuthRateLimiter';

const prisma = new PrismaClient();

const userRouter = express.Router();

//Google Auth
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID!);

//TODO - FIX CONTROLLERS, VERIFY EMAIL

//Get an agent
userRouter.get(
  '/agent/id/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id, role: 'agent' },
      include: {
        properties: true,
        reviewsReceived: { include: { reviewer: true } },
      },
    });
    if (!user) {
      res.status(404);
      throw new Error('Agent not found');
    }
    const currentSubscription = await prisma.subscription.findFirst({
      where: { agentId: user.id, isActive: true },
      include: { plan: true },
    });

    const agent = {
      ...user,
      currentSubscription: currentSubscription?.plan.name,
    };
    res.json(agent);
  })
);
userRouter.get(
  '/agent/username/:username',
  asyncHandler(async (req, res) => {
    const { username } = req.params;
    console.log(username);

    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        properties: true,
        reviewsReceived: { include: { reviewer: true } },
      },
    });
    if (!user) {
      res.status(404);
      throw new Error('Agent not found');
    }
    const currentSubscription = await prisma.subscription.findFirst({
      where: { agentId: user.id, isActive: true },
      include: { plan: true },
    });

    const agent = {
      ...user,
      currentSubscription: currentSubscription?.plan.name,
    };
    res.json(agent);
  })
);

userRouter.post(
  '/signup',
  authRateLimiterMiddleware,
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

    const verificationToken = nanoid(32);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        phone_number,
        password_hash: hashedPassword,
        role: 'buyer',
        verificationToken,
      },
    });

    const verifyUrl = `http://localhost:3000/verify-email?token=${verificationToken}`;
    // const verifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/verify-email?token=${verificationToken}`;

    sendVerificationEmail({ email, verifyUrl });

    const token = generateToken({ id: newUser.id, role: newUser.role });

    res.status(201).json({
      message: 'User registered successfully',
      isSignedIn: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        emailVerified: newUser.emailVerified,
        twoFactorEnabled: newUser.twoFactorEnabled,
      },
      token,
    });
  })
);

userRouter.get(
  '/resend-verification',
  authRateLimiterMiddleware,
  isAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.user;
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      res
        .status(400)
        .send({ message: 'No user Found or Invalid or expired token' });
    }

    // const verifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/verify-email?token=${user?.verificationToken}`;
    const verifyUrl = `http://localhost:3000//verify-email?token=${user?.verificationToken}`;

    const email = user?.email || '';

    sendVerificationEmail({ email, verifyUrl });
    res.status(200).json({ message: 'Verification Email Resent' });
  })
);

userRouter.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const { token } = req.body;

    const user = await prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      res.status(400).send({ message: 'Invalid or expired token' });
    }

    await prisma.user.update({
      where: { id: user?.id },
      data: {
        emailVerified: true,
        verificationToken: null,
      },
    });
    res.status(200).json({ message: 'Email verified successfully' });
  })
);

userRouter.post(
  '/signout',
  asyncHandler(async (req, res) => {
    // Clear your auth cookie (example: "userInfo")
    res.clearCookie('userInfo', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none', // or "lax" depending on your frontend setup
      path: '/', // IMPORTANT: path must match cookie creation path
    });

    res.status(200).json({
      status: 'success',
      message: 'Signed out successfully',
    });
    return;
  })
);

userRouter.post(
  '/signin',
  authRateLimiterMiddleware,

  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const now = new Date();

    const user = await prisma.user.findUnique({
      where: { email },
      include: { saved_properties: true, saved_searches: true },
    });
    if (!user) {
      await req.logActivity({
        category: 'AUTH',
        action: 'FAILED_LOGIN',
        description: `Failed login attempt for ${email}`,
      });
      res.status(400).json({ message: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await req.logActivity({
        category: 'AUTH',
        action: 'FAILED_LOGIN',
        description: `Failed login attempt for ${email}`,
      });
      res.status(400).json({ message: 'Invalid email or password' });
      return;
    }

    if (user.isDeleted) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          isDeleted: false,
          deletedAt: null,
        },
      });
    }

    if (user.twoFactorEnabled) {
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
    }

    // Regular login flow (same as before)
    const verificationToken = nanoid(32);

    const verifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/verify-email?token=${verificationToken}`;

    if (!user.emailVerified) {
      sendVerificationEmail({ email, verifyUrl });
    }
    if (!user.twoFactorEnabled) {
      await req.logActivity({
        category: 'AUTH',
        action: 'USER_LOGIN',
        description: `${user.email} signed in`,
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { last_login: now },
      });
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
        saved_properties: savedPropertyIds,
        saved_searches: savedSearchesIds,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      token,
      isSignedIn: true,
    });
  })
);

userRouter.post(
  '/resend-2fa',
  authRateLimiterMiddleware,

  // isAuth, // must be logged in
  asyncHandler(async (req, res) => {
    const { userId } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (user.provider === 'GOOGLE' || !user.twoFactorEnabled) {
      res.status(400).json({ message: '2FA not enabled for this user' });
      return;
    }

    if (user.twoFactorEnabled) {
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
    }
  })
);

userRouter.post(
  '/verify-2fa',
  authRateLimiterMiddleware,

  asyncHandler(async (req, res) => {
    const { userId, code } = req.body;
    const now = new Date();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        saved_properties: true,
        saved_searches: true,
      },
    });
    if (!user || !user.twoFactorEnabled || !user.twoFactorCode) {
      res.status(400).json({ message: '2FA not enabled or code missing' });
      return;
    }

    if (
      user.twoFactorCode !== code ||
      !user.twoFactorExpiresAt ||
      user.twoFactorExpiresAt < new Date()
    ) {
      res.status(400).json({ message: 'Invalid or expired 2FA code' });
      return;
    }

    // Clear the code after success
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorCode: null,
        twoFactorExpiresAt: null,
        emailVerified: true,
      },
    });

    await req.logActivity({
      category: 'AUTH',
      action: 'USER_LOGIN',
      description: `${user.email} signed in`,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { last_login: now },
    });

    const token = generateToken({ id: user.id, role: user.role });
    const savedPropertyIds = user.saved_properties.map((prop) => prop.id);
    const savedSearchesIds = user.saved_searches.map((search) => search.id);
    res.status(200).json({
      message: '2FA verified',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        saved_properties: savedPropertyIds,
        saved_searches: savedSearchesIds,
        twoFactorEnabled: updatedUser.twoFactorEnabled,
        emailVerified: updatedUser.emailVerified,
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
    const now = new Date();

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
            emailVerified: true,
            verificationToken: null,
            provider: 'GOOGLE',
            twoFactorEnabled: false,
          },
          include: {
            saved_properties: { select: { id: true } },
            saved_searches: { select: { id: true } },
          },
        });
      }

      if (user && user.provider !== 'GOOGLE') {
        await req.logActivity({
          category: 'AUTH',
          action: 'FAILED_LOGIN',
          description: `Failed login attempt for ${email}`,
        });
        throw new Error('Account exists. Use email and password to sign in.');
      }

      if (user.isDeleted) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            isDeleted: false,
            deletedAt: null,
          },
        });
      }
      await req.logActivity({
        category: 'AUTH',
        action: 'USER_LOGIN',
        description: `${user.email} signed in`,
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { last_login: now },
      });

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
          emailVerified: user.emailVerified,
          twoFactorEnabled: user.twoFactorEnabled,
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

//forgot passoword
userRouter.post(
  '/forgot-password',
  authRateLimiterMiddleware,
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(200).json({
        message:
          'If an account with that email exists, a 6 digit code has been sent.',
      });
      return;
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour expiry
      },
    });

    const resetUrl = `http://localhost:3000/reset-password?token=${token}`; //TODO CHANGE THIS TO FRONTEND URL
    await sendResetPasswordEmail({ email: user.email, resetUrl }); // Implement this

    res.json({ message: 'Reset link sent' });
  })
);
userRouter.post(
  '/send-change-password-otp',
  authRateLimiterMiddleware,
  isAuth,
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(200).json({
        message:
          'If an account with that email exists, a password reset link has been sent.',
      });
      return;
    }

    const code = generate2FACode(); // e.g., '847392'
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordCode: code,
        resetPasswordCodeExpiresAt: expiry,
      },
    });

    await send2FACodeEmail({ email: user.email, code });

    res.status(200).json({
      message: 'Reset Password code sent to email',
      userId: user.id,
    });
  })
);

//reset password
userRouter.post(
  '/change-password',
  authRateLimiterMiddleware,
  isAuth,
  asyncHandler(async (req, res) => {
    const { userId, newPassword } = req.body;
    const now = new Date();

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
      },
    });

    if (!user) {
      res.status(400);
      throw new Error('Invalid or expired token');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        last_password_change: now,
      },
    });
    await req.logActivity({
      category: 'ACCOUNT',
      action: 'USER_CHANGE_PASSWORD',
      description: `${user.email} editted profile`,
      changes: { before: user, after: user },
    });

    await sendPasswordChangedEmail({ email: user.email });

    res.json({ message: 'Password reset successful' });
  })
);

userRouter.post(
  '/verify-change-password-otp',
  authRateLimiterMiddleware,
  asyncHandler(async (req, res) => {
    const { userId, code } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        saved_properties: true,
        saved_searches: true,
      },
    });
    if (!user || !user.resetPasswordCode) {
      res.status(400).json({ message: 'Code missing' });
      return;
    }

    if (
      user.resetPasswordCode !== code ||
      !user.resetPasswordCodeExpiresAt ||
      user.resetPasswordCodeExpiresAt < new Date()
    ) {
      res.status(400).json({ message: 'Invalid or expired code' });
      return;
    }

    // Clear the code after success
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordCode: null,
        resetPasswordCodeExpiresAt: null,
        emailVerified: true,
      },
    });

    res.status(200).json({
      message: '2FA verified',
    });
  })
);

//Edit Profile
userRouter.put(
  '/profile',
  isAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;

    const { name, email } = req.body;

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
      },
    });
    await req.logActivity({
      category: 'ACCOUNT',
      action: 'USER_EDIT_PROFILE',
      description: `${updatedUser.email} editted profile`,
      changes: { before: user, after: updatedUser },
    });

    res.json({
      message: 'Profile updated successfully',
      isSignedIn: true,
      token: generateToken({ id: updatedUser.id, role: updatedUser.role }),
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    });
  })
);

userRouter.patch(
  '/toggle-2fa',
  isAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const newValue = !user.twoFactorEnabled;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: newValue },
    });
    await req.logActivity({
      category: 'ACCOUNT',
      action: 'USER_EDIT_PROFILE',
      description: `${user.email} editted profile`,
      changes: { before: user, after: updatedUser },
    });

    res.json({ message: `2FA ${newValue ? 'enabled' : 'disabled'}` });
  })
);

//Delete User
userRouter.delete(
  '/deactivate-account',
  isAuth,
  asyncHandler(async (req, res) => {
    //HARD DELETE
    // const userId = req.user?.id;
    // if (!userId) {
    //   res.status(401).send({ message: 'Not authorized' }); // Changed to .send and added return
    //   return;
    // }

    // const user = await prisma.user.findUnique({ where: { id: userId } });

    // if (!user) {
    //   res.status(404).send({ message: 'User not found' }); // Changed to .send and added return
    //   return;
    // }

    // await prisma.user.delete({ where: { id: userId } });

    // res.status(200).json({ message: 'Your account has been deleted.' });

    // SOFT DELETE
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
    await prisma.user.update({
      where: { id: userId },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    await req.logActivity({
      category: 'ACCOUNT',
      action: 'USER_SOFT_DELETE',
      description: `${user.email} deleted account`,
    });
    res.json({ message: 'User restored', user });
  })
);

// Restore user
userRouter.patch(
  '/users/:id/restore',
  isAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await prisma.user.update({
      where: { id },
      data: { isDeleted: false },
    });
    await req.logActivity({
      category: 'ACCOUNT',
      action: 'USER_RESTORE',
      description: `${user.email} restored account.`,
    });

    res.json({ message: 'User restored', user });
  })
);

// Get saved Properties and Seaeches
userRouter.get(
  '/saved',
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
        saved_searches: {},
      },
    });
    const data = {
      saved_properties: userWithSaved?.saved_properties,
      saved_searches: userWithSaved?.saved_searches,
    };

    if (!userWithSaved) {
      res.status(404).send({ message: 'User not found' });
    }

    res.json(data);
  })
);

// save a search
userRouter.post(
  '/save-search',
  isAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { query, sendAlerts } = req.body;
    console.log('query: ', query);

    if (!query || typeof query !== 'object') {
      res
        .status(400)
        .json({ message: 'Query is required and must be an object' });
    }

    const searchName = generateSearchName(query);

    const savedSearch = await prisma.savedSearch.create({
      data: {
        userId,
        query,
        sendAlerts: sendAlerts || false,
        name: searchName,
      },
      include: { user: true },
    });

    await req.logActivity({
      category: 'USER_ACTION',
      action: 'USER_SAVE_SEARCH',
      description: `${savedSearch.user.email} saved a search.`,
      metadata: { search: savedSearch, user: savedSearch.user },
    });

    res.status(201).json(savedSearch);
  })
);

// unsave a search
userRouter.delete(
  '/unsave-search/',
  isAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.user;
    const { query } = req.body;
    console.log(query);

    const user = await prisma.user.findUnique({
      where: id,
    });
    const deleted = await prisma.savedSearch.deleteMany({
      where: {
        query: {
          equals: query, // full deep match
        },
      },
    });
    await req.logActivity({
      category: 'USER_ACTION',
      action: 'USER_UNSAVE_SEARCH',
      description: `${user?.email} saved a search.`,
      metadata: { search: deleted, user },
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

// //Get all agents
// userRouter.get(
//   '/agents',
//   asyncHandler(async (req, res) => {

//     const {search, sort}=req.query as {search:string, sort:string}

//     if(search){

//     }
//     const page = parseInt(req.query.page as string) || 1;
//     // TODO change default limit
//     const limit = parseInt(req.query.limit as string) || 100;
//     const skip = (page - 1) * limit;

//     const where = { role: 'agent' as const };

//     const [agents, totalItems] = await prisma.$transaction([
//       prisma.user.findMany({
//         where,
//         skip,
//         take: limit,
//         orderBy: { created_at: 'desc' },
//         include: {
//           properties: true, // Include their listed properties
//           reviewsReceived: { include: { reviewer: true } },
//           Subscriptions: { include: { plan: true } },
//         },
//       }),
//       prisma.user.count({ where }),
//     ]);

//     const pages = Math.ceil(totalItems / limit);

//     res.json({ agents, totalItems, page, pages });
//   })
// );

//check availability of username for agents

userRouter.get(
  '/check-username',
  asyncHandler(async (req, res) => {
    const { username } = req.query as { username?: string };

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
    if (agent) {
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

userRouter.get(
  '/agents',
  asyncHandler(async (req, res) => {
    const { search = '', sort = 'default' } = req.query as {
      search?: string;
      sort?: string;
    };

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = (page - 1) * limit;

    // If sorting by top rated, need to do manual sorting after fetching all (inefficient on large datasets)
    if (sort === 'ratingDesc') {
      const allAgents = await prisma.user.findMany({
        where: {
          role: 'agent' as const,
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        include: {
          properties: true,
          reviewsReceived: true,
          Subscriptions: { include: { plan: true } },
        },
      });

      const sortedAgents = allAgents
        .map((agent) => {
          const totalRatings = agent.reviewsReceived.reduce(
            (acc, r) => acc + r.rating,
            0
          );
          const averageRating =
            agent.reviewsReceived.length > 0
              ? totalRatings / agent.reviewsReceived.length
              : 0;
          return { ...agent, averageRating };
        })
        .sort((a, b) => b.averageRating - a.averageRating);

      const paginatedAgents = sortedAgents.slice(skip, skip + limit);
      const totalItems = sortedAgents.length;
      const pages = Math.ceil(totalItems / limit);

      res.json({ agents: paginatedAgents, totalItems, page, pages });
    }

    // A-Z sort
    let orderBy: any = { created_at: 'desc' };
    if (sort === 'nameAsc') orderBy = { name: 'asc' };

    const [agents, totalItems] = await prisma.$transaction([
      prisma.user.findMany({
        where: {
          role: 'agent' as const,
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        skip,
        take: limit,
        orderBy,
        include: {
          properties: true,
          reviewsReceived: true,
          Subscriptions: { include: { plan: true } },
        },
      }),
      prisma.user.count({
        where: {
          role: 'agent' as const,
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
      }),
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

userRouter.get(
  '/tiers',
  asyncHandler(async (req, res) => {
    try {
      const tiers = await prisma.subscriptionTier.findMany({
        include: {
          SubscriptionPlan: true,
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

        return {
          id: tier.id,
          name: tier.name,
          features: tier.features,
          description: tier.description,
          monthlyPrice: monthlyPlan?.price || 0,
          yearlyPrice: yearlyPlan?.price || 0,
        };
      });

      res.json(formatted);
    } catch (error) {
      console.error('Error fetching tiers:', error);
      res.status(500).json({ message: 'Failed to fetch subscription tiers' });
    }
  })
);

//Review an agent
userRouter.post(
  '/agent/:id/reviews',
  isAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reviewerId, comment, rating } = req.body;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    const agent = await prisma.user.findUnique({
      where: { id, role: 'agent' },
      include: { reviewsReceived: true },
    });

    if (!agent) {
      res.status(404).send({ message: 'Agent not found' });
      return;
    }

    if (agent.reviewsReceived.find((x) => x.reviewerId === user?.id)) {
      res.status(400).send({ message: 'You already submitted a review' });
      return;
    }

    const review = await prisma.agentReview.create({
      data: {
        reviewerId,
        rating: Number(rating),
        comment,
        agentId: agent.id,
      },
      include: { reviewer: true },
    });

    await req.logActivity({
      category: 'USER_ACTION',
      action: 'USER_POST_REVIEW',
      description: `${user?.email} posted a review on ${agent.name}.`,
      metadata: { agent, review, reviewer: review.reviewer },
    });

    res.status(201).send({
      message: 'Review Created',
      review,
    });
  })
);

//edit a review
userRouter.put(
  '/agent/reviews/:id',
  isAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { comment, rating } = req.body;

    const updatedReview = await prisma.agentReview.update({
      where: { id },
      data: {
        rating: Number(rating),
        comment,
      },
      include: { reviewer: true, agent: true },
    });

    await req.logActivity({
      category: 'USER_ACTION',
      action: 'USER_POST_REVIEW',
      description: `${updatedReview.reviewer.email} updated a review on ${updatedReview.agent.name}.`,
      metadata: {
        agent: updatedReview.agent,
        review: updatedReview,
        reviewer: updatedReview.reviewer,
      },
    });

    res.status(201).send({
      message: 'Review Edited',
      review: updatedReview,
    });
  })
);

//delete a review
userRouter.delete(
  '/agent/reviews/:id',
  isAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const review = await prisma.agentReview.delete({
      where: { id },
      include: {
        reviewer: true,
        agent: true,
      },
    });

    await req.logActivity({
      category: 'USER_ACTION',
      action: 'USER_DELETE_REVIEW',
      description: `${review.reviewer.email} deleted a review on ${review.agent.name}.`,
      metadata: {
        agent: review.agent,
        review: review,
        reviewer: review.reviewer,
      },
    });

    res.status(201).send({
      message: 'Review Deleted',
    });
  })
);

export default userRouter;
