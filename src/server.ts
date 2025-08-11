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
import { Server } from 'socket.io';
import './jobs/searchAlerts'; // This starts the cron job
import { activityLoggerMiddleware } from './middleware/activityLogger';
import { isAuth } from './middleware/auth';

dotenv.config();
const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
// app.use(isAuth); // sets req.user
app.use(activityLoggerMiddleware);

// allow CORS
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000'], // TODO frontend origin
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
