import { JwtPayload } from 'jsonwebtoken';
import { TokenPayload } from '../utils/auth';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload | JwtPayload;
    }
  }
}

// declare module 'express-serve-static-core' {
//   interface Request {
//     filter?: {
//       properties?: {
//         approvalStatus?: 'approved' | 'pending' | 'rejected';
//         approval_status?: 'approved' | 'pending' | 'rejected';
//         agent?: {
//           isVerified?: boolean;
//           is_verified?: boolean;
//         };
//       };
//       agents?: {
//         isVerified?: boolean;
//         is_verified?: boolean;
//       };
//     };
//   }
// }

// src/types/express/index.d.ts
// import { JwtPayload } from 'jsonwebtoken';
// import { TokenPayload } from '../../middleware/auth';
// // import { TokenPayload } from '../utils/auth';

// declare module 'express-serve-static-core' {
//   interface Request {
//     user?: TokenPayload | JwtPayload;
//     filter?: {
//       properties?: {
//         approvalStatus?: 'approved' | 'pending' | 'rejected';
//         approval_status?: 'approved' | 'pending' | 'rejected';
//         agent?: {
//           isVerified?: boolean;
//           is_verified?: boolean;
//         };
//       };
//       agents?: {
//         isVerified?: boolean;
//         is_verified?: boolean;
//       };
//     };
//   }
// }
