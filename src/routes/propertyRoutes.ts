import express from 'express';
import { Request, Response } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import asyncHandler from 'express-async-handler';

const prisma = new PrismaClient();

const propertyRouter = express.Router();

propertyRouter.get(
  //TODO FILTER OUT ONLY APPROVED PROPERTIES
  '/',
  asyncHandler(async (req, res) => {
    const properties = await prisma.property.findMany({});
    res.send(properties);
  })
);

export default propertyRouter;
