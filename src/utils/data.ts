import {
  Furnishing,
  ListingType,
  PropertyStatus,
  PropertyType,
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
      profile_picture: 'https://github.com/shadcn.png',
      phone_number: '09128734756',
    },
    {
      name: 'Agent User',
      email: 'agent@example.com',
      password_hash: bcrypt.hashSync('123456'),
      role: 'agent' as UserRole,
      profile_picture: 'https://github.com/shadcn.png',
      phone_number: '09128734756',
    },
    {
      name: 'Admin User',
      email: 'admin@example.com',
      password_hash: bcrypt.hashSync('123456'),
      role: 'admin' as UserRole,
      profile_picture: 'https://github.com/shadcn.png',
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
      bedrooms: 5,
      bathrooms: 5,
      toilets: 6,
      size_sqm: 795.97,
      price: 1000000000.0,
      property_type: 'detached' as PropertyType,
      listing_type: 'sale' as ListingType,
      furnishing: 'furnished' as Furnishing,
      status: 'available' as PropertyStatus,
      street: 'Joel Ogunaike',
      city: 'Ikeja',
      state: 'Lagos',
    },
    {
      // id: '680865753756596',
      // agentId: '39f36cb6-0fcc-4c88-afa7-eed65bc3a5c0', // ✅ Correct FK scalar
      title: '3 Bedroom Apartment For Sale',
      description:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aliquam quis quam et consequat. Donec risus velit, vestibulum at dapibus sed, rhoncus sit amet ligula. Cras accumsan ante finibus diam fringilla, nec ultricies ex semper. Cras imperdiet tortor in consequat facilisis. Aliquam eleifend gravida urna eu porttitor. Mauris augue ante, euismod ac ullamcorper et, interdum a neque. Vestibulum augue felis, malesuada ut eleifend a, pharetra vitae massa. Aenean scelerisque id ipsum non faucibus. Integer id metus nec eros sollicitudin rhoncus vel et velit. Proin sagittis eleifend ipsum, nec iaculis dolor laoreet elementum. Donec ante velit, mattis quis turpis ut, maximus vestibulum nibh. Nam volutpat rutrum nibh, vel finibus tortor auctor non. Donec a volutpat ipsum. Proin ullamcorper tellus felis, nec fermentum augue auctor id. Pellentesque ac molestie enim, eget feugiat ipsum.',
      bedrooms: 3,
      bathrooms: 3,
      toilets: 4,
      size_sqm: 495.97,
      price: 200000000.0,
      property_type: 'apartment' as PropertyType,
      listing_type: 'sale' as ListingType,
      furnishing: 'furnished' as Furnishing,
      status: 'available' as PropertyStatus,
      street: 'Saka Jojo',
      city: 'Victoria Island',
      state: 'Lagos',
    },
    // {
    //   id: '680865753756596',
    //   // agent   :       "975884860876098",
    //   // agent: '975884860876098',
    //   agentId: '975884860876098',
    //   title: '3 Bedroom Apartment For Sale',
    //   description:
    //     'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aliquam quis quam et consequat. Donec risus velit, vestibulum at dapibus sed, rhoncus sit amet ligula. Cras accumsan ante finibus diam fringilla, nec ultricies ex semper. Cras imperdiet tortor in consequat facilisis. Aliquam eleifend gravida urna eu porttitor. Mauris augue ante, euismod ac ullamcorper et, interdum a neque. Vestibulum augue felis, malesuada ut eleifend a, pharetra vitae massa. Aenean scelerisque id ipsum non faucibus. Integer id metus nec eros sollicitudin rhoncus vel et velit. Proin sagittis eleifend ipsum, nec iaculis dolor laoreet elementum. Donec ante velit, mattis quis turpis ut, maximus vestibulum nibh. Nam volutpat rutrum nibh, vel finibus tortor auctor non. Donec a volutpat ipsum. Proin ullamcorper tellus felis, nec fermentum augue auctor id. Pellentesque ac molestie enim, eget feugiat ipsum.',
    //   bedrooms: 3,
    //   bathrooms: 3,
    //   toilets: 4,
    //   size_sqm: 495.97,
    //   price: 200000000.0,
    //   // discount_percent Float?
    //   // discounted_price Float?

    //   property_type: 'apartment' as PropertyType,
    //   listing_type: 'sale' as ListingType,
    //   furnishing: 'furnished' as Furnishing,
    //   // availability:   String?
    //   status: 'available' as PropertyStatus,
    //   // amenities  :    String[]
    //   // date_added  :   DateTime @default(now())
    //   // date_modified : DateTime @updatedAt
    //   // is_approved  :  Boolean  @default(false)
    //   // images        : PropertyImage[]
    //   street: 'Saka Jojo',
    //   city: 'Victoria Island',
    //   state: 'Lagos',
    // },
  ],
};

export default data;
