import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import express, { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { isAgent, isAuth } from '../utils/auth';

cloudinary.config({
  // TODO CREATE ONE FOR SETTLA
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

const uploadRouter = express.Router();

uploadRouter.post(
  '/image',
  isAuth,
  isAgent,
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const file = req.file as Express.Multer.File; // ✅ Type assertion here

    if (!file) {
      res.status(400);
      throw new Error('No file uploaded');
    }

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'properties', resource_type: 'image' },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      uploadStream.end(file.buffer);
    });

    res.status(200).json({ secure_url: (result as any).secure_url });
  })
);

uploadRouter.post(
  '/pdf',
  isAuth,
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const file = req.file as Express.Multer.File; // ✅ Type assertion here

    if (!file) {
      res.status(400);
      throw new Error('No file uploaded');
    }

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'verification_docs', resource_type: 'raw' },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      uploadStream.end(file.buffer);
    });

    res.status(200).json({ url: (result as any).secure_url });
  })
);

export default uploadRouter;
