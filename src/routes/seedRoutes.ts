import express from 'express';
import asyncHandler from 'express-async-handler';
import { PrismaClient } from '@prisma/client';
import data from '../utils/data';

const prisma = new PrismaClient();
const seedRouter = express.Router();

seedRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    // Optional: Clear existing users
    // await prisma.user.deleteMany({});
    // await prisma.property.deleteMany({});

    // const createdUsers = await prisma.user.createMany({ data: data.users });
    // const createdProperties = await prisma.property.createMany({
    //   data: data.properties,
    // });
    const createdSubscriptionTiers = await prisma.subscriptionTier.createMany({
      data: data.subscriptionTiers,
    });

    // res.status(201).json({ message: 'Seeded Properties' });
    // res.status(201).json({ message: 'Seeded users', count: users.count });
    res.send({
      // createdUsers, createdProperties,
      createdSubscriptionTiers,
    });
    // res.send({ properties, properties2 });
    // res.send({ users });
  })
);

export default seedRouter;
