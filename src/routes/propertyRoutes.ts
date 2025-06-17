import express from 'express';
import { Request, Response } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import asyncHandler from 'express-async-handler';

const prisma = new PrismaClient();

const propertyRouter = express.Router();

//TODO FILTER OUT ONLY APPROVED PROPERTIES
propertyRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const properties = await prisma.property.findMany({});
    res.send(properties);
  })
);

propertyRouter.get(
  '/:listingType',
  asyncHandler(async (req, res) => {
    const { listingType } = req.params;

    if (
      listingType !== 'sale' &&
      listingType !== 'rent' &&
      listingType !== 'shortlet'
    ) {
      res.status(400);
      throw new Error('Invalid listing type. Use "sale" or "rent".');
    }

    const properties = await prisma.property.findMany({
      where: {
        listing_type: listingType,
      },
      include: {
        agent: {
          select: { id: true, name: true }, // example: include minimal agent info
        },
      },
    });

    res.status(200).json(properties);
  })
);

propertyRouter.get(
  '/id/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const property = await prisma.property.findUnique({
      where: { id: id },
      include: {
        agent: {
          select: { id: true, name: true, email: true, profile_picture: true }, // Optional: get agent info
        },
      },
    });

    if (!property) {
      res.status(404);
      throw new Error('Property not found');
    }

    res.status(200).json(property);
  })
);

export default propertyRouter;
