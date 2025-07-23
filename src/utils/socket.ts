// server/utils/socket.ts
import { Server } from 'socket.io';

let io: Server;

export const initializeSocket = (server: any) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    if (userId) {
      socket.join(userId); // Join room with userId
    }

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });

  return io;
};

export const sendNotificationToUser = (
  userId: string,
  data: { title: string; message: string }
) => {
  if (!io) {
    console.error('Socket.io not initialized');
    return;
  }

  io.to(userId).emit('new_notification', data);
};

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}
