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

// Import all new services
import RealtimeService from './services/realtimeService';
import DynamicNFTService from './services/dynamicNFTService';
import AchievementService from './services/achievementService';
import VerificationService from './services/verificationService';

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:3000", "http://localhost:3001"],
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
    }
});

// Initialize all services
let realtimeService: RealtimeService;
let dynamicNFTService: DynamicNFTService;
let achievementService: AchievementService;
let verificationService: VerificationService;

// Enhanced CORS configuration
app.use(cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
    credentials: true
}));

app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
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

// Add services to request object
app.use((req: any, res, next) => {
    req.io = io;
    req.realtimeService = realtimeService;
    req.dynamicNFTService = dynamicNFTService;
    req.achievementService = achievementService;
    req.verificationService = verificationService;
    next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/identity', identityRoutes);
app.use('/api/achievements', achievementRoutes);

// New service endpoints
app.get('/api/analytics/realtime', async (req, res) => {
    try {
        const stats = await realtimeService.getRealtimeStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get analytics' });
    }
});

app.get('/api/nft/metadata/:tokenId', async (req, res) => {
    try {
        const tokenId = parseInt(req.params.tokenId);
        const metadata = await dynamicNFTService.generateMetadata(tokenId);
        res.json({ success: true, data: metadata });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to generate metadata' });
    }
});

app.post('/api/achievements/verify', async (req, res) => {
    try {
        const { tokenId, achievementId, proof } = req.body;
        const result = await verificationService.verifyAchievementOnChain(tokenId, achievementId, proof);
        res.json({ success: result });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Verification failed' });
    }
});

app.get('/api/achievements/stats', async (req, res) => {
    try {
        const stats = await achievementService.getAchievementStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get achievement stats' });
    }
});

app.post('/api/external/verify', async (req, res) => {
    try {
        const { tokenId, platform, achievementData } = req.body;
        const result = await verificationService.verifyExternalAchievement(tokenId, platform, achievementData);
        res.json({ success: result });
    } catch (error) {
        res.status(500).json({ success: false, error: 'External verification failed' });
    }
});

// SDK Integration endpoint
app.get('/api/sdk/identity/:address', async (req, res) => {
    try {
        const { address } = req.params;
        // Implementation for SDK identity lookup
        res.json({ success: true, data: null, message: 'SDK endpoint ready' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'SDK request failed' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        services: {
            database: 'Connected',
            realtime: realtimeService ? 'Active' : 'Inactive',
            nftService: dynamicNFTService ? 'Active' : 'Inactive',
            achievements: achievementService ? 'Active' : 'Inactive',
            verification: verificationService ? 'Active' : 'Inactive'
        },
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
    res.json({
        message: 'SomniaID API is working!',
        features: [
            'Real-time updates',
            'Dynamic NFT metadata',
            'Achievement system',
            'Cross-platform SDK',
            'Live analytics',
            'Blockchain verification'
        ]
    });
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

// Initialize services after database connection
const initializeServices = () => {
    realtimeService = new RealtimeService(io);
    dynamicNFTService = new DynamicNFTService();
    achievementService = new AchievementService(realtimeService);
    verificationService = new VerificationService();

    console.log('✅ All services initialized');

    // Start background tasks
    setInterval(async () => {
        try {
            await achievementService.manualAchievementCheck(0, 'automated_check');
            await verificationService.runAutomatedVerification();
            await realtimeService.getRealtimeStats();
        } catch (error) {
            console.error('Background task error:', error);
        }
    }, 60000); // Run every minute

    console.log('🔄 Background tasks started');
};

// Connect to database
connectDB().then(() => {
    initializeServices();
}).catch((error) => {
    console.error('Failed to connect to database:', error);
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log('🚀 =================================');
    console.log('🚀 SomniaID Backend Server Started');
    console.log('🚀 =================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
    console.log(`📊 Database: ${process.env.MONGODB_URI ? 'Connected' : 'Local'}`);
    console.log(`🔥 Real-time updates: ENABLED`);
    console.log(`🎯 Dynamic NFTs: ENABLED`);
    console.log(`🏆 Achievement system: ENABLED`);
    console.log(`🌐 Cross-platform SDK: ENABLED`);
    console.log(`📊 Live analytics: ENABLED`);
    console.log(`🔐 Blockchain verification: ENABLED`);
    console.log('🚀 =================================');
});

export default app;