import {
  Furnishing,
  ListingType,
  PropertyStatus,
  PropertyType,
  SubscriptionTierType,
  UserRole,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const data = {
  users: [
    {
      name: 'Buyer User',
      email: 'buyer@example.com',
      password_hash: bcrypt.hashSync('123456'),
      role: 'buyer' as UserRole,
      phone_number: '09128734756',
    },
    {
      name: 'Agent User',
      email: 'agent@example.com',
      password_hash: bcrypt.hashSync('123456'),
      role: 'agent' as UserRole,
      logo: 'https://github.com/shadcn.png',
      phone_number: '09128734756',
      bio: "With over a decade of experience in the real estate industry, Agent brings unparalleled expertise and a passion for connecting clients with their dream homes. Specializing in residential properties, Agent excels at navigating the complexities of the market to secure the best deals for buyers and sellers alike. Known for a client-first approach, they prioritize clear communication, personalized service, and a deep understanding of local trends. Whether you're a first-time homebuyer or a season",
    },
    {
      name: 'Agent User2',
      email: 'agent2@example.com',
      password_hash: bcrypt.hashSync('123456'),
      role: 'agent' as UserRole,
      logo: 'https://github.com/shadcn.png',
      phone_number: '09128837656',
      bio: 'Agent2 is a dynamic real estate professional with a knack for finding hidden gems in competitive markets. With five years of experience and a background in property investment, Agent2 combines sharp negotiation skills with a keen eye for value, ensuring clients maximize their investments. They pride themselves on building lasting relationships, offering tailored guidance, and staying ahead of market shifts. From cozy starter homes to luxury estates, Agent2 is committed to delivering results with integrity and enthusiasm.',
    },
    {
      name: 'Admin User',
      email: 'admin@example.com',
      password_hash: bcrypt.hashSync('123456'),
      role: 'admin' as UserRole,
      phone_number: '09128734756',
    },
  ],
  properties: [
    {
      // id: '680865758756596',
      // agentId: '39f36cb6-0fcc-4c88-afa7-eed65bc3a5c0', // ✅ Correct FK scalar
      title: '5 Bedroom Duplex For Sale',
      description:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aliquam quis quam et consequat. Donec risus velit, vestibulum at dapibus sed, rhoncus sit amet ligula. Cras accumsan ante finibus diam fringilla, nec ultricies ex semper. Cras imperdiet tortor in consequat facilisis. Aliquam eleifend gravida urna eu porttitor. Mauris augue ante, euismod ac ullamcorper et, interdum a neque. Vestibulum augue felis, malesuada ut eleifend a, pharetra vitae massa. Aenean scelerisque id ipsum non faucibus. Integer id metus nec eros sollicitudin rhoncus vel et velit. Proin sagittis eleifend ipsum, nec iaculis dolor laoreet elementum. Donec ante velit, mattis quis turpis ut, maximus vestibulum nibh. Nam volutpat rutrum nibh, vel finibus tortor auctor non. Donec a volutpat ipsum. Proin ullamcorper tellus felis, nec fermentum augue auctor id. Pellentesque ac molestie enim, eget feugiat ipsum.',
      bedrooms: '5',
      bathrooms: '5',
      toilets: '6',
      parking_spaces: '5',
      size_sqm: 795.97,
      price: 1000000000.0,
      amenities: [
        'Fitted Kitchen',
        'Swimming Pool',
        'Balcony',
        'Broadband Internet',
        'Serviced',
        'CCTV',
        'Gym',
        '24/7 Electricity',
        'Water Supply',
        'En Suite',
        'Elevator',
        'Penthouse',
      ],
      property_type: 'detached' as PropertyType,
      listing_type: 'sale' as ListingType,
      furnishing: 'furnished' as Furnishing,
      status: 'available' as PropertyStatus,
      street: 'Joel Ogunnaike',
      city: 'Ikeja',
      state: 'Lagos',
      lat: 6.5854773,
      lon: 3.3523171,
      images: [
        'https://res.cloudinary.com/domz2drcf/image/upload/v1750331906/properties/gl2iag3sja2wbvwyltg5.jpg',
      ],
    },
    {
      // id: '680865753756596',
      // agentId: '39f36cb6-0fcc-4c88-afa7-eed65bc3a5c0', // ✅ Correct FK scalar
      title: '3 Bedroom Apartment For Sale',
      description:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aliquam quis quam et consequat. Donec risus velit, vestibulum at dapibus sed, rhoncus sit amet ligula. Cras accumsan ante finibus diam fringilla, nec ultricies ex semper. Cras imperdiet tortor in consequat facilisis. Aliquam eleifend gravida urna eu porttitor. Mauris augue ante, euismod ac ullamcorper et, interdum a neque. Vestibulum augue felis, malesuada ut eleifend a, pharetra vitae massa. Aenean scelerisque id ipsum non faucibus. Integer id metus nec eros sollicitudin rhoncus vel et velit. Proin sagittis eleifend ipsum, nec iaculis dolor laoreet elementum. Donec ante velit, mattis quis turpis ut, maximus vestibulum nibh. Nam volutpat rutrum nibh, vel finibus tortor auctor non. Donec a volutpat ipsum. Proin ullamcorper tellus felis, nec fermentum augue auctor id. Pellentesque ac molestie enim, eget feugiat ipsum.',
      bedrooms: '3',
      bathrooms: '3',
      toilets: '4',
      parking_spaces: '5',
      size_sqm: 495.97,
      price: 200000000.0,
      property_type: 'apartment' as PropertyType,
      listing_type: 'sale' as ListingType,
      furnishing: 'furnished' as Furnishing,
      status: 'available' as PropertyStatus,
      street: 'Saka Jojo',
      city: 'Victoria Island',
      state: 'Lagos',
      lat: 6.4275841,
      lon: 3.4135112,
      images: [
        'https://res.cloudinary.com/domz2drcf/image/upload/v1750331906/properties/gl2iag3sja2wbvwyltg5.jpg',
      ],
      amenities: [
        'Parking',
        'Security',
        'Balcony',
        'Broadband Internet',
        'Gym',
        '24/7 Electricity',
        'Built-in Wardrobes',
        'Air Conditioning',
        'Elevator',
        'Penthouse',
      ],
    },
    {
      title: 'Luxury 3 Bedroom Apartment in Victoria Island',
      description:
        'Stunning modern apartment with panoramic views of Lagos. Features open-plan living, gourmet kitchen, and premium finishes throughout. The building offers 24/7 security, gym, and swimming pool.',
      bedrooms: '2',
      bathrooms: '3',
      toilets: '3',
      parking_spaces: '5',
      size_sqm: 495.97,
      price: 150000000.0,
      property_type: 'apartment' as PropertyType,
      listing_type: 'sale' as ListingType,
      furnishing: 'furnished' as Furnishing,
      status: 'available' as PropertyStatus,
      street: 'Muri Okunola',
      city: 'Victoria Island',
      state: 'Lagos',
      lat: 6.4378201,
      lon: 3.4250833,
      images: [
        'https://res.cloudinary.com/domz2drcf/image/upload/v1750331906/properties/gl2iag3sja2wbvwyltg5.jpg',
      ],
      amenities: [
        'Parking',
        'Security',
        'Balcony',
        'Broadband Internet',
        'Gym',
        '24/7 Electricity',
        'Built-in Wardrobes',
        'Air Conditioning',
        'Elevator',
        'Penthouse',
      ],
    },
    {
      title: '5-Bedroom Detached Duplex in Lekki',
      description:
        'Spacious family home in a secure estate. Features include a large garden, staff quarters, and ample parking space. Close to international schools and shopping centers.',
      bedrooms: '5',
      bathrooms: '4',
      toilets: '6',
      parking_spaces: '5',
      size_sqm: 850.5,
      price: 350000000.0,
      property_type: 'detached' as PropertyType,
      listing_type: 'sale' as ListingType,
      furnishing: 'furnished' as Furnishing,
      status: 'sold' as PropertyStatus,
      street: 'Admiralty Way',
      city: 'Eti Osa',
      state: 'Lagos',
      lat: 6.442284,
      lon: 3.454339,
      images: [
        'https://res.cloudinary.com/domz2drcf/image/upload/v1750331906/properties/gl2iag3sja2wbvwyltg5.jpg',
      ],
      amenities: [
        'Serviced',
        'CCTV',
        'Close to top schools',
        '24/7 Security',
        'Gym',
        '24/7 Electricity',
        'Water Supply',
        'En Suite',
        'Built-in Wardrobes',
        'Air Conditioning',
        'Elevator',
        'Penthouse',
      ],
    },
    {
      title: 'Modern 2-Bedroom Flat for Rent in Ikoyi',
      description:
        'Elegant apartment in a prime location. Features include smart home system, concierge service, and shared recreational facilities. Perfect for young professionals.',
      bedrooms: '2',
      bathrooms: '2',
      toilets: '2',
      parking_spaces: '5',
      size_sqm: 320.25,
      price: 8000000.0,
      property_type: 'apartment' as PropertyType,
      listing_type: 'rent' as ListingType,
      furnishing: 'furnished' as Furnishing,
      status: 'unavailable' as PropertyStatus,
      street: 'Glover Road',
      city: 'Ikoyi',
      state: 'Lagos',
      lat: 6.4537615,
      lon: 3.4337483,
      images: [
        'https://res.cloudinary.com/domz2drcf/image/upload/v1750331906/properties/gl2iag3sja2wbvwyltg5.jpg',
      ],
      amenities: [
        'Fitted Kitchen',
        'Swimming Pool',
        'Balcony',
        'Broadband Internet',
        'Close to top schools',
        '24/7 Security',
        'Water Supply',
        'En Suite',
        'Elevator',
        'Penthouse',
      ],
      tenancy_info:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aliquam quis quam et consequat. Donec risus velit, vestibulum at dapibus sed, rhoncus sit amet ligula. Cras accumsan ante finibus diam fringilla, nec ultricies ex semper. Cras imperdiet tortor in consequat facilisis. Aliquam eleifend gravida urna eu porttitor. Mauris augue ante, euismod ac ullamcorper et, interdum a neque. Vestibulum augue felis, malesuada ut eleifend a, pharetra vitae massa. Aenean scelerisque id ipsum non faucibus. Integer id metus nec eros sollicitudin rhoncus vel et velit. Proin sagittis eleifend ipsum, nec iaculis dolor laoreet elementum. Donec ante velit, mattis quis turpis ut, maximus vestibulum nibh. Nam volutpat rutrum nibh, vel finibus tortor auctor non.',

      service_charge: '1000000',
      min_tenancy: '1 year',
      deposit: 1000000,
    },
    {
      title: '5 Bedroom House for Sale in Banana Island',
      description:
        'Premium office space in Lagos most exclusive neighborhood. High ceilings, natural light, and fiber internet ready. Includes access to business lounge and meeting rooms.',
      bedrooms: '5',
      bathrooms: '5',
      toilets: '6',
      parking_spaces: '5',
      size_sqm: 1200.0,
      price: 150000000.0,
      property_type: 'terrace' as PropertyType,
      listing_type: 'sale' as ListingType,
      furnishing: 'furnished' as Furnishing,
      status: 'available' as PropertyStatus,
      street: 'Ondo Street',
      city: 'Ikoyi',
      state: 'Lagos',
      lat: 6.4641415,
      lon: 3.4266052,
      images: [
        'https://res.cloudinary.com/domz2drcf/image/upload/v1750331906/properties/gl2iag3sja2wbvwyltg5.jpg',
      ],
      amenities: [
        'Parking',
        'Security',
        'Close to top schools',
        '24/7 Security',
        'Gym',
        '24/7 Electricity',
        'Built-in Wardrobes',
        'Air Conditioning',
        'Elevator',
        'Penthouse',
      ],
    },
    {
      title: '3-Bedroom Terrace House in GRA',
      description:
        'Charming renovated home with original architectural details. Features private garden, modern kitchen, and dedicated parking. Located in a quiet, tree-lined street.',
      bedrooms: '3',
      bathrooms: '2',
      toilets: '3',
      parking_spaces: '5',
      size_sqm: 420.75,
      price: 180000000.0,
      property_type: 'terrace' as PropertyType,
      listing_type: 'sale' as ListingType,
      furnishing: 'furnished' as Furnishing,
      status: 'available' as PropertyStatus,
      street: 'Isaac John',
      city: 'Ikeja',
      state: 'Lagos',
      lat: 6.5802972,
      lon: 3.3588271,
      images: [
        'https://res.cloudinary.com/domz2drcf/image/upload/v1750331906/properties/gl2iag3sja2wbvwyltg5.jpg',
      ],
      amenities: [
        'Water Supply',
        'En Suite',
        'Built-in Wardrobes',
        'Air Conditioning',
        'Elevator',
        'Penthouse',
      ],
    },
    {
      title: 'Luxury Shortlet Apartment in Eko Atlantic',
      description:
        'High-end serviced apartment with daily cleaning. Features floor-to-ceiling windows, smart home technology, and access to private beach club. Minimum 3-night stay.',
      bedrooms: '2',
      bathrooms: '2',
      toilets: '2',
      parking_spaces: '5',
      size_sqm: 380.0,
      price: 250000.0,
      property_type: 'apartment' as PropertyType,
      listing_type: 'shortlet' as ListingType,
      furnishing: 'furnished' as Furnishing,
      status: 'available' as PropertyStatus,
      street: 'Eko Boulevard',
      city: 'Eko Atlantic',
      state: 'Lagos',
      lat: 6.4095595,
      lon: 3.417737,
      images: [
        'https://res.cloudinary.com/domz2drcf/image/upload/v1750331906/properties/gl2iag3sja2wbvwyltg5.jpg',
      ],
      amenities: [
        'Serviced',
        'CCTV',
        'Water Supply',
        'En Suite',
        'Built-in Wardrobes',
        'Air Conditioning',
        'Elevator',
        'Penthouse',
      ],
    },
  ],
  subscriptionTiers: [
    {
      name: 'basic' as SubscriptionTierType,
      price: 0,
      features: {
        maxListings: 'Up to 5 Listings',
        visibility: 'Basic profile visibility',
        leadAccess: 'Limited lead access',
        support: 'Email Support within 48 hours',
        analytics: false,
        accountManager: false,
        featuredBadge: false,
        boosters: false,
        pow: false,
      },
    },
    {
      name: 'premium' as SubscriptionTierType,
      price: 4999, // assume NGN (₦) or use USD depending on your business
      features: {
        maxListings: 'Unlimited Listings',
        visibility: 'Priority profile visibility',
        leadAccess: 'Full access to leads',
        support: 'Email Support within 48 hours',
        analytics: 'Basic analytics',
        accountManager: false,
        featuredBadge: false,
        boosters: false,
        pow: false,
      },
    },
    {
      name: 'enterprise' as SubscriptionTierType,
      price: 19999,
      features: {
        maxListings: 'Unlimited Listings',
        visibility: 'Priority profile visibility',
        leadAccess: 'Full access to leads',
        support: '24/7 Support',
        analytics: 'Advanced analytics',
        accountManager: 'Dedicated Account manager',
        featuredBadge: true,
        boosters: 'Access to boosters',
        pow: "Access to 'Property of the Week'",
      },
    },
  ],
};

export function getBillingPeriod(startDateStr: string, endDateStr: string) {
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  const diffMonths =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());

  if (diffMonths === 1) {
    return 'MONTHLY';
  } else if (diffMonths === 12) {
    return 'YEARLY';
  }

  return null;
}

export interface SearchQuery {
  listing_type?: 'sale' | 'rent' | 'shortlet';
  property_type?: string; // e.g., 'house', 'flat', 'apartment'
  min_beds?: number;
  max_beds?: number;
  location_label?: string; // e.g., 'London', 'Manchester'
  // ... other potential query keys you might have, but won't be used for the name
  // [key: string]: any; // Allow other properties
}

// --- NEW FUNCTION TO GENERATE SEARCH NAMES ---
export function generateSearchName(query: SearchQuery | undefined): string {
  if (!query) {
    return 'Unnamed Search (No Criteria)';
  }

  const parts: string[] = [];
  let bedsPart = '';
  let propertyTypePart = '';
  let listingTypePart = '';
  let locationPart = '';

  const { listing_type, property_type, min_beds, max_beds, location_label } =
    query;

  // 1. Handle Beds
  if (min_beds && max_beds) {
    if (min_beds === max_beds) {
      bedsPart = `${min_beds}-bed`;
    } else {
      bedsPart = `${min_beds} to ${max_beds}-bed`;
    }
  } else if (min_beds) {
    bedsPart = `${min_beds}+ bed`; // Assuming min_beds implies "or more"
  } else if (max_beds) {
    bedsPart = `Up to ${max_beds}-bed`;
  }

  // 2. Handle Property Type
  if (property_type) {
    // Basic title-casing for property type (e.g., 'house' -> 'House')
    propertyTypePart =
      property_type.charAt(0).toUpperCase() + property_type.slice(1);
  }

  // 3. Combine Beds and Property Type
  if (bedsPart && propertyTypePart) {
    parts.push(`${bedsPart} ${propertyTypePart}`);
  } else if (bedsPart) {
    parts.push(bedsPart);
  } else if (propertyTypePart) {
    parts.push(propertyTypePart);
  }

  parts.push('Properties');

  // 4. Handle Listing Type
  if (listing_type) {
    switch (listing_type) {
      case 'sale':
        listingTypePart = 'for sale';
        break;
      case 'rent':
        listingTypePart = 'to rent';
        break;
      case 'shortlet':
        listingTypePart = 'for shortlets';
        break;
      default:
        // Fallback for unknown listing types, or you can choose to ignore
        listingTypePart = '';
    }
    if (listingTypePart) {
      parts.push(listingTypePart);
    }
  }

  // 5. Handle Location Label
  if (location_label) {
    locationPart = `in ${location_label}`;
    parts.push(locationPart);
  }

  // Join all parts
  const generatedName = parts.join(' ').trim();

  // Return a fallback if the generated name is empty (e.g., if query only had irrelevant keys)
  return generatedName || 'Unnamed Search (No Relevant Criteria)';
}

export default data;
