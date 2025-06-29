import express from 'express';
import { Request, Response } from 'express';
import { Prisma, PrismaClient, UserRole } from '@prisma/client';
import asyncHandler from 'express-async-handler';

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
    if (location_label) {
      const [cityPart, statePart] = location_label
        .split(',')
        .map((part: string) => part.trim());

      filters.push({
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

    // Keyword search in title, city, street, description

    if (query) {
      filters.push({
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { city: { contains: query, mode: 'insensitive' } },
          { street: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      });
    }

    // Time added filter
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
      if (dateFilter) filters.push({ date_added: { gte: dateFilter } });
    }

    // Numeric filters
    if (min_beds && min_beds !== 'any')
      filters.push({ bedrooms: { gte: min_beds } });
    if (max_beds && max_beds !== 'any')
      filters.push({ bedrooms: { lte: max_beds } });

    if (min_baths && min_baths !== 'any')
      filters.push({ bathrooms: { gte: min_baths } });
    if (max_baths && max_baths !== 'any')
      filters.push({ bathrooms: { lte: max_baths } });

    if (min_price) filters.push({ price: { gte: parseFloat(min_price) } });
    if (max_price) filters.push({ price: { lte: parseFloat(max_price) } });

    // Enum filters (skip if "all")
    if (property_type && property_type !== 'all') {
      const types = Array.isArray(property_type)
        ? property_type
        : [property_type];
      filters.push({ property_type: { in: types } });
    }

    if (furnishing && furnishing !== 'all') {
      const types = Array.isArray(furnishing) ? furnishing : [furnishing];
      filters.push({ furnishing: { in: types } });
    }

    if (listing_type && listing_type !== 'all') {
      filters.push({ listing_type: { equals: listing_type } });
    }

    if (status && status !== 'all') {
      filters.push({ status: { equals: status } });
    }

    // Amenities filter
    if (amenities) {
      const amenityArray = Array.isArray(amenities) ? amenities : [amenities];
      filters.push({ amenities: { hasSome: amenityArray } });
    }

    // Radius search using lat/lon
    if (lat && lon && Number(radius) > 0) {
      const propertiesInRadius = await prisma.$queryRawUnsafe<any[]>(`
        SELECT id FROM "Property"
        WHERE lat IS NOT NULL AND lon IS NOT NULL
        AND earth_distance(ll_to_earth(${lat}, ${lon}), ll_to_earth(lat, lon)) < ${
        Number(radius) * 1000
      }
      `);
      const idsInRadius = propertiesInRadius.map((p) => p.id);
      if (idsInRadius.length > 0) filters.push({ id: { in: idsInRadius } });
      else res.json({ properties: [], page: 1, pages: 0, totalItems: 0 });
    }

    let orderBy: Prisma.PropertyOrderByWithRelationInput = {
      date_added: 'desc',
    };

    if (sort === 'price_asc') {
      orderBy = { price: 'asc' };
    } else if (sort === 'price_desc') {
      orderBy = { price: 'desc' };
    } else if (sort === 'oldest') {
      orderBy = { date_added: 'asc' };
    } else if (sort === 'newest') {
      orderBy = { date_added: 'desc' };
    }
    // Pagination
    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;
    console.log('Final filters:', JSON.stringify(filters, null, 2));

    const [properties, totalItems] = await prisma.$transaction([
      prisma.property.findMany({
        where: filters.length > 0 ? { AND: filters } : {},
        skip,
        take: pageSize,
        orderBy,
      }),
      prisma.property.count({
        where: filters.length > 0 ? { AND: filters } : {},
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
        agent: {
          select: { id: true, name: true, email: true, logo: true }, // Optional: get agent info
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
