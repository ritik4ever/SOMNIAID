import { Server } from 'socket.io';

export const setupSocketHandlers = (io: Server): void => {
    console.log('🔌 Setting up Socket.IO handlers');

    io.on('connection', (socket) => {
        console.log('👤 User connected:', socket.id);

        socket.on('disconnect', () => {
            console.log('👋 User disconnected:', socket.id);
        });
    });

    console.log('✅ Socket.IO handlers configured');
};