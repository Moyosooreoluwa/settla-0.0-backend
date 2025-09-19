import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import userRouter from './routes/userRoutes';
import seedRouter from './routes/seedRoutes';
import propertyRouter from './routes/propertyRoutes';
import agentRouter from './routes/agentRoutes';
import uploadRouter from './routes/uploadRoutes';
import adminRouter from './routes/adminRoutes';
import leadRouter from './routes/leadRoutes';
import nodemailer from 'nodemailer';
import http from 'http';
import helmet from 'helmet';
import { Server } from 'socket.io';
import './jobs/searchAlerts'; // This starts the cron job
import { activityLoggerMiddleware } from './middleware/activityLogger';

const allowedOrigins = [
  'http://localhost:3000', // local dev
  'http://localhost:3001', // local dev
  'http://localhost:3002', // local dev
  'https://yourfrontend.com', // production frontend
];

dotenv.config();
const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

// FOR MULTIPLE SUBDOMAINS
// const allowedOrigins = [
//   'http://localhost:3000', // local dev
// ];

// // Function to validate origin dynamically
// function corsOrigin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
//   if (!origin) {
//     // Allow non-browser tools like curl/postman
//     return callback(null, true);
//   }

//   // Allow localhost (dev)
//   if (allowedOrigins.includes(origin)) {
//     return callback(null, true);
//   }

//   // Allow any subdomain of settla.com
//   const settlaRegex = /^https:\/\/([a-z0-9-]+\.)?settla\.com$/;
//   if (settlaRegex.test(origin)) {
//     return callback(null, true);
//   }

//   // Otherwise reject
//   return callback(new Error('Not allowed by CORS'));
// }
app.use(helmet());
// app.use(
//   helmet({
//     contentSecurityPolicy: process.env.NODE_ENV === 'production', // only enforce CSP in prod
//     crossOriginEmbedderPolicy: false, // often disabled if you serve 3rd-party media
//   })
// );

// helmet({
//     // Helps prevent attacks like clickjacking
//     frameguard: { action: 'deny' },

//     // Prevent browsers from sniffing MIME types
//     noSniff: true,

//     // Hide "X-Powered-By: Express"
//     hidePoweredBy: true,

//     // Basic XSS filter (older browsers, extra layer)
//     xssFilter: true as any, // cast needed in TS, since deprecated in types

//     // Content Security Policy (CSP)
//     contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
//       useDefaults: true,
//       directives: {
//         "default-src": ["'self'"],
//         "script-src": ["'self'", "'unsafe-inline'", "https://maps.googleapis.com"],
//         "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
//         "font-src": ["'self'", "https://fonts.gstatic.com"],
//         "img-src": ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://*.amazonaws.com"],
//         "connect-src": ["'self'", "https://api.mapbox.com", "https://maps.googleapis.com"],
//         "frame-src": ["'self'", "https://www.google.com"], // allow embedded maps
//       },
//     } : false, // disable CSP in dev (too annoying)
//   })

// frameguard: deny → no iframes embedding your app (prevents clickjacking).

// noSniff → stops MIME sniffing (protects file uploads).

// hidePoweredBy → removes Express fingerprinting.

// xssFilter → legacy, but still adds a header for older browsers.

// CSP → restricts scripts, styles, fonts, images, and API calls:

// Images only from your domain, Cloudinary, or S3.

// Scripts only from your app + Google Maps.

// Styles from your app + Google Fonts.

// Prevents rogue scripts/images from running.

// ⚠️ Gotchas

// If you later embed YouTube videos, ads, or other iframes, you’ll need to update frame-src.

// If you add another image provider/CDN, add it under img-src.

// During development, CSP is disabled (so you don’t keep fighting headers).

// Express CORS
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use(express.json());
// app.use(isAuth); // sets req.user
app.use(activityLoggerMiddleware);

// allow CORS
const io = new Server(server, {
  cors: {
    origin: allowedOrigins, // TODO frontend origin
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Socket.IO events
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io globally accessible if needed
export { io };

app.get('/', (req, res) => {
  res.send('API Running 🚀');
});

export const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER, // your email address
    pass: process.env.SMTP_PASS, // your app password
  },
});

app.use('/api/users', userRouter);
app.use('/api/agents', agentRouter);
app.use('/api/properties', propertyRouter);
app.use('/api/admin', adminRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/leads', leadRouter);
app.use('/api/seed', seedRouter);

// app.use((err, req, res, next) => {
//   const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
//   res.status(statusCode).json({
//     message: err.message,
//     stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
//   });
// });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
