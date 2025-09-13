// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/database';
import authRoutes from './routes/auth';
import identityRoutes from './routes/identity';
import achievementRoutes from './routes/achievements';
import { initializeBlockchainService } from './services/blockchainService';
import { setupSocketHandlers } from './services/socketService';
import { initializeMonitoring } from './utils/monitoring';

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:3000", "http://localhost:3001"],
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
    }
});

// Initialize services
initializeBlockchainService();
initializeMonitoring();
setupSocketHandlers(io);

// Enhanced CORS configuration
app.use(cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));

app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Increased for development
    message: 'Too many requests, please try again later'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// Add io to request object
app.use((req: any, res, next) => {
    req.io = io;
    next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/identity', identityRoutes);  // This should handle /api/identity/create
app.use('/api/achievements', achievementRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        env: {
            nodeEnv: process.env.NODE_ENV || 'development',
            hasContract: !!process.env.CONTRACT_ADDRESS,
            hasJWT: !!process.env.JWT_SECRET,
            hasMongoDB: !!process.env.MONGODB_URI
        }
    });
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ message: 'API is working!' });
});

// Catch all for API routes
app.use('/api/*', (req, res) => {
    console.log(`API route not found: ${req.method} ${req.path}`);
    res.status(404).json({
        success: false,
        error: `API endpoint not found: ${req.method} ${req.path}`
    });
});

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
});

// Connect to database
connectDB();

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log('🚀 =================================');
    console.log('🚀 SomniaID Backend Server Started');
    console.log('🚀 =================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
    console.log(`📊 Database: ${process.env.MONGODB_URI ? 'Connected' : 'Local'}`);
    console.log('🚀 =================================');
});

export default app;