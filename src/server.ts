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

dotenv.config();
const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('API Running 🚀');
});

app.use('/api/users', userRouter);
app.use('/api/agents', agentRouter);
app.use('/api/properties', propertyRouter);
app.use('/api/admin', adminRouter);
app.use('/api/upload', uploadRouter);
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
