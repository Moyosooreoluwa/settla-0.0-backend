import { z } from 'zod';

// --- ENUMS ---
export const PropertyTypeEnum = z.enum([
  'apartment',
  'land',
  'semi_detached',
  'detached',
  'terrace',
  'commercial',
  'warehouse',
]);

export const ListingTypeEnum = z.enum(['sale', 'rent', 'shortlet']);

export const FurnishingEnum = z.enum([
  'furnished',
  'partly_furnished',
  'unfurnished',
]);

export const PropertyStatusEnum = z.enum([
  'available',
  'sold',
  'rented',
  'unavailable',
  'unlisted',
]);

export const numberOptionsEnum = z.enum([
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10+',
]);

export const CurrencyEnum = z.enum(['NGN', 'USD']);

// --- MAIN PROPERTY VALIDATION SCHEMA ---
export const propertyValidationSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters long')
    .max(300, 'Title is too long'),

  description: z
    .string()
    .min(10, 'Description must be at least 10 characters long')
    .max(2000, 'Description too long'),

  bedrooms: numberOptionsEnum,

  bathrooms: numberOptionsEnum,

  toilets: numberOptionsEnum,

  size_sqm: z
    .union([z.string(), z.number()])
    .refine((v) => !isNaN(Number(v)), 'Size must be a number')
    .transform((v) => Number(v)),

  price: z
    .union([z.string(), z.number()])
    .refine((v) => !isNaN(Number(v)), 'Price must be a number')
    .transform((v) => Number(v)),

  discount_percent: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (v >= 0 && v <= 100), {
      message: 'Discount percent must be between 0 and 100',
    }),

  property_type: PropertyTypeEnum,
  listing_type: ListingTypeEnum,
  furnishing: FurnishingEnum,
  status: PropertyStatusEnum,

  // amenities: z.array(z.string()).optional(),  // You said you’re leaving it out for now

  street: z.string().min(3, 'Street name is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),

  lat: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine(
      (v) => v === null || (v >= -90 && v <= 90),
      'Latitude must be between -90 and 90'
    ),

  lon: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine(
      (v) => v === null || (v >= -180 && v <= 180),
      'Longitude must be between -180 and 180'
    ),

  parking_spaces: numberOptionsEnum.optional(),

  currency: CurrencyEnum.default('NGN'),

  video_link: z
    .string()
    .url('Video link must be a valid URL')
    .optional()
    .or(z.literal('')),

  // RENTALS
  availability: z.string().optional(),
  tenancy_info: z.string().optional(),
  service_charge: z.string().optional(),
  min_tenancy: z.string().optional(),
  deposit: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => (v ? Number(v) : null)),
});

export type PropertySchema = z.infer<typeof propertyValidationSchema>;
