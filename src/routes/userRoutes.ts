import express from 'express';
// import { userSignIn, userRegister } from '../src/controllers/userController';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '@prisma/client';
import asyncHandler from 'express-async-handler';
import { generateToken, isAuth } from '../utils/auth';

const prisma = new PrismaClient();

const userRouter = express.Router();

//TODO - FIX CONTROLLERS, VERIFY EMAIL, SOFT DELETE

userRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { name, email, password, phone_number } = req.body;

    if (!name || !email || !password || !phone_number) {
      res.status(400);
      throw new Error('All fields are required');
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      res.status(400);
      throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        phone_number,
        password_hash: hashedPassword,
        role: 'buyer',
        profile_picture: 'https://github.com/shadcn.png',
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
        profile_picture: newUser.profile_picture,
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

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      res.status(400);
      throw new Error('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      res.status(400).send({ message: 'Invalid email or password' });
      throw new Error('Invalid email or password');
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

//Edit Profile
userRouter.put(
  '/profile',
  isAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id; // Available because of isAuth

    const { name, email, phone_number, profile_picture, password } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    // Update only if provided
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name || user.name,
        email: email || user.email,
        phone_number: phone_number || user.phone_number,
        profile_picture: profile_picture || user.profile_picture,
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
        profile_picture: updatedUser.profile_picture,
        role: updatedUser.role,
      },
    });
  })
);

userRouter.delete(
  '/me',
  isAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401);
      throw new Error('Not authorized');
    }

    // Optional: check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    await prisma.user.delete({ where: { id: userId } });

    res.status(200).json({ message: 'Your account has been deleted.' });
  })
);

export default userRouter;
