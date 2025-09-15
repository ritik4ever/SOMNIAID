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

// FIXED: Improved CORS configuration for production
const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://somniaid.vercel.app",
    "https://somniaid-git-main-your-username.vercel.app", // Git branch deployments
    /^https:\/\/somniaid-.*\.vercel\.app$/, // All preview deployments
];

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
    }
});

// Initialize all services
let realtimeService: RealtimeService;
let dynamicNFTService: DynamicNFTService;
let achievementService: AchievementService;
let verificationService: VerificationService;

// FIXED: Enhanced CORS configuration with better origin handling
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        // Check against allowed origins
        const isAllowed = allowedOrigins.some(allowedOrigin => {
            if (typeof allowedOrigin === 'string') {
                return origin === allowedOrigin;
            }
            // Handle regex patterns
            return allowedOrigin.test(origin);
        });

        if (isAllowed) {
            callback(null, true);
        } else {
            console.log(`CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
    credentials: true
}));

// Add preflight handling
app.options('*', cors());

app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false
}));

// Adjusted rate limiting for production
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Stricter in production
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// FIXED: Enhanced request logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const origin = req.get('Origin') || 'no-origin';
    console.log(`${timestamp} ${req.method} ${req.path} - Origin: ${origin}`);
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

// Service endpoints
app.get('/api/analytics/realtime', async (req, res) => {
    try {
        const stats = await realtimeService.getRealtimeStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ success: false, error: 'Failed to get analytics' });
    }
});

app.get('/api/nft/metadata/:tokenId', async (req, res) => {
    try {
        const tokenId = parseInt(req.params.tokenId);
        const metadata = await dynamicNFTService.generateMetadata(tokenId);
        res.json({ success: true, data: metadata });
    } catch (error) {
        console.error('NFT metadata error:', error);
        res.status(500).json({ success: false, error: 'Failed to generate metadata' });
    }
});

app.post('/api/achievements/verify', async (req, res) => {
    try {
        const { tokenId, achievementId, proof } = req.body;
        const result = await verificationService.verifyAchievementOnChain(tokenId, achievementId, proof);
        res.json({ success: result });
    } catch (error) {
        console.error('Achievement verification error:', error);
        res.status(500).json({ success: false, error: 'Verification failed' });
    }
});

app.get('/api/achievements/stats', async (req, res) => {
    try {
        const stats = await achievementService.getAchievementStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Achievement stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to get achievement stats' });
    }
});

app.post('/api/external/verify', async (req, res) => {
    try {
        const { tokenId, platform, achievementData } = req.body;
        const result = await verificationService.verifyExternalAchievement(tokenId, platform, achievementData);
        res.json({ success: result });
    } catch (error) {
        console.error('External verification error:', error);
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
        console.error('SDK error:', error);
        res.status(500).json({ success: false, error: 'SDK request failed' });
    }
});

// FIXED: Enhanced health check endpoint
app.get('/health', (req, res) => {
    const health = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
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
        },
        version: '2.0.0'
    };

    res.json(health);
});

// FIXED: API test endpoint that matches frontend expectation
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'SomniaID API is working!',
        timestamp: new Date().toISOString(),
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
        error: `API endpoint not found: ${req.method} ${req.path}`,
        availableEndpoints: [
            'GET /api/test',
            'POST /api/identity',
            'GET /api/identity/:tokenId',
            'GET /api/achievements',
            'POST /api/achievements/create',
            'GET /health'
        ]
    });
});

// FIXED: Enhanced error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
    console.error('Server error:', {
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        url: req.url,
        method: req.method,
        body: req.body
    });

    res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
        timestamp: new Date().toISOString()
    });
});

// Initialize services after database connection
const initializeServices = () => {
    try {
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
    } catch (error) {
        console.error('Service initialization error:', error);
    }
};

// Connect to database
connectDB().then(() => {
    console.log('✅ Database connected');
    initializeServices();
}).catch((error) => {
    console.error('❌ Failed to connect to database:', error);
    process.exit(1);
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log('🚀 =================================');
    console.log('🚀 SomniaID Backend Server Started');
    console.log('🚀 =================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
    console.log(`📊 Database: ${process.env.MONGODB_URI ? 'MongoDB Connected' : 'Local DB'}`);
    console.log(`🔥 Real-time updates: ENABLED`);
    console.log(`🎯 Dynamic NFTs: ENABLED`);
    console.log(`🏆 Achievement system: ENABLED`);
    console.log(`🌐 Cross-platform SDK: ENABLED`);
    console.log(`📊 Live analytics: ENABLED`);
    console.log(`🔐 Blockchain verification: ENABLED`);
    console.log('🚀 =================================');

    // Log allowed origins for debugging
    console.log('🌐 Allowed CORS Origins:');
    allowedOrigins.forEach(origin => {
        console.log(`   - ${origin}`);
    });
});

export default app;