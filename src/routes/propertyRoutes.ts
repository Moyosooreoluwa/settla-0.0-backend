import express from 'express';
import { Request, Response } from 'express';
import { Prisma, PrismaClient, UserRole } from '@prisma/client';
import asyncHandler from 'express-async-handler';
import { isAuth } from '../utils/auth';

const prisma = new PrismaClient();

const propertyRouter = express.Router();

//TODO FILTER OUT ONLY APPROVED PROPERTIES

propertyRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const {
      query = '',
      lat,
      lon,
      radius = '0',
      location_label,
      time_added,
      min_beds,
      max_beds,
      min_baths,
      max_baths,
      min_price,
      max_price,
      property_type,
      furnishing,
      amenities,
      listing_type,
      status,
      sort,
      page = '1',
      limit = '10',
    } = req.query as Record<string, any>;

    const filters: any[] = [];
    console.log(`${req.query?.lengtth ?? 'No queries'}`);

    console.log(req.query);
    // Handle location_label parsing
    const coreFilters: any[] = [];
    const locationFilters: any[] = [];

    // --- 1. Split location filters ---
    if (location_label) {
      const [cityPart, statePart] = location_label
        .split(',')
        .map((part: string) => part.trim());

      locationFilters.push({
        OR: [
          { title: { contains: cityPart, mode: 'insensitive' } },
          { description: { contains: cityPart, mode: 'insensitive' } },
          { description: { contains: location_label, mode: 'insensitive' } },
          { city: { contains: cityPart, mode: 'insensitive' } },
          {
            AND: [
              { city: { equals: cityPart, mode: 'insensitive' } },
              { state: { equals: statePart, mode: 'insensitive' } },
            ],
          },
        ],
      });
    }

    if (query) {
      locationFilters.push({
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { city: { contains: query, mode: 'insensitive' } },
          { street: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      });
    }

    // --- 2. Core filters ---
    if (time_added) {
      const now = new Date();
      let dateFilter;
      switch (time_added) {
        case '24h':
          dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '1w':
          dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '1m':
          dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
      if (dateFilter) coreFilters.push({ date_added: { gte: dateFilter } });
    }

    if (min_beds && min_beds !== 'any')
      coreFilters.push({ bedrooms: { gte: min_beds } });
    if (max_beds && max_beds !== 'any')
      coreFilters.push({ bedrooms: { lte: max_beds } });

    if (min_baths && min_baths !== 'any')
      coreFilters.push({ bathrooms: { gte: min_baths } });
    if (max_baths && max_baths !== 'any')
      coreFilters.push({ bathrooms: { lte: max_baths } });

    if (min_price) coreFilters.push({ price: { gte: parseFloat(min_price) } });
    if (max_price) coreFilters.push({ price: { lte: parseFloat(max_price) } });

    if (property_type && property_type !== 'all') {
      const types = Array.isArray(property_type)
        ? property_type
        : [property_type];
      coreFilters.push({ property_type: { in: types } });
    }

    if (furnishing && furnishing !== 'all') {
      const types = Array.isArray(furnishing) ? furnishing : [furnishing];
      coreFilters.push({ furnishing: { in: types } });
    }

    if (listing_type && listing_type !== 'all') {
      coreFilters.push({ listing_type: { equals: listing_type } });
    }

    if (status && status !== 'all') {
      coreFilters.push({ status: { equals: status } });
    }

    if (amenities) {
      const amenityArray = Array.isArray(amenities)
        ? amenities
        : amenities.split(',').map((a: string) => a.trim());
      coreFilters.push({ amenities: { hasSome: amenityArray } });
    }

    //TODO FIX RADIUS SEARCH
    //  Radius search using lat/lon

    let where: any = {};
    if (lat && lon && Number(radius) > 0) {
      //   const propertiesInRadius = await prisma.$queryRawUnsafe<any[]>(
      //     `
      // SELECT id FROM "Property"
      // WHERE lat IS NOT NULL AND lon IS NOT NULL
      // AND earth_distance(
      //   ll_to_earth($1::double precision, $2::double precision),
      //   ll_to_earth(lat, lon)
      // ) < $3
      // `,
      //     lat,
      //     lon,
      //     Number(radius) * 1000
      //   );

      const propertiesInRadius = await prisma.$queryRawUnsafe<any[]>(
        `
  SELECT id FROM "Property"
  WHERE lat IS NOT NULL AND lon IS NOT NULL
  AND earth_distance(
    ll_to_earth(CAST($1 AS float8), CAST($2 AS float8)),
    ll_to_earth(CAST(lat AS float8), CAST(lon AS float8))
  ) < $3
  `,
        lat,
        lon,
        Number(radius) * 1000
      );

      const idsInRadius = propertiesInRadius.map((p) => p.id);
      const radiusFilter = { id: { in: idsInRadius } };

      where = {
        OR: [
          { AND: [...coreFilters, ...locationFilters] },
          { AND: [...coreFilters, radiusFilter] },
        ],
      };
    } else {
      where = {
        AND: [...coreFilters, ...locationFilters],
      };
    }
    let orderBy: Prisma.PropertyOrderByWithRelationInput[] = [
      { visibility: 'desc' },
    ];

    if (sort === 'price_asc') {
      orderBy.push({ price: 'asc' });
    } else if (sort === 'price_desc') {
      orderBy.push({ price: 'desc' });
    } else if (sort === 'oldest') {
      orderBy.push({ date_added: 'asc' });
    } else {
      orderBy.push({ date_added: 'desc' });
    }
    // Pagination
    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;
    console.log('Final filters:', JSON.stringify(filters, null, 2));

    const [properties, totalItems] = await prisma.$transaction([
      prisma.property.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
      }),
      prisma.property.count({
        where,
      }),
    ]);
    console.log('Final filters:', JSON.stringify(filters, null, 2));
    console.log('Final orderBy:', orderBy);

    res.json({
      properties,
      page: pageNumber,
      pages: Math.ceil(totalItems / pageSize),
      totalItems,
    });
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
        agent: true,
        reviews: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            reviewer: true,
            reviewerId: true,
          },
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

// Save a property
propertyRouter.post(
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
propertyRouter.delete(
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

//Review a property
propertyRouter.post(
  '/:id/reviews',
  isAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reviewerId, comment, rating } = req.body;
    const property = await prisma.property.findUnique({
      where: { id },
      include: { reviews: true },
    });

    if (!property) {
      res.status(404).send({ message: 'Property not found' });
      return;
    }

    if (property.reviews.find((x) => x.reviewerId === req.user.id)) {
      res.status(400).send({ message: 'You already submitted a review' });
      return;
    }

    const review = await prisma.propertyReview.create({
      data: {
        reviewerId,
        rating: Number(rating),
        comment,
        propertyId: property.id,
      },
      include: { reviewer: true },
    });

    res.status(201).send({
      message: 'Review Created',
      review,
    });
  })
);

//edit a review
propertyRouter.put(
  '/reviews/:id',
  isAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { comment, rating } = req.body;

    const updatedReview = await prisma.propertyReview.update({
      where: { id },
      data: {
        rating: Number(rating),
        comment,
      },
      include: { reviewer: true },
    });

    res.status(201).send({
      message: 'Review Edited',
      review: updatedReview,
    });
  })
);

//delete a review
propertyRouter.delete(
  '/reviews/:id',
  isAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    await prisma.propertyReview.delete({
      where: { id },
    });

    res.status(201).send({
      message: 'Review Deleted',
    });
  })
);

export default propertyRouter;
