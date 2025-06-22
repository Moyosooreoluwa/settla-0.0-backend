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
    res.status(200).json({
      message: 'Signin successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone_number: user.phone_number,
        saved_properties: savedPropertyIds,
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

      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name: name || 'Google User',
            password_hash: sub,
            role: 'buyer',
          },
        });
      }

      const authToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET as string,
        { expiresIn: '7d' }
      );

      res.status(200).json({
        message: 'Signin successful',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone_number: user.phone_number,
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

export default userRouter;
