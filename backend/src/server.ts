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

// Import all services
import RealtimeService from './services/realtimeService';
import DynamicNFTService from './services/dynamicNFTService';
import AchievementService from './services/achievementService';
import VerificationService from './services/verificationService';
import blockchainSync from './services/blockchain-sync';

const app = express();
const server = createServer(app);

// CORS configuration
const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://somniaid.vercel.app",
    "https://somniaid-git-main-your-username.vercel.app",
    /^https:\/\/somniaid-.*\.vercel\.app$/,
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

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        const isAllowed = allowedOrigins.some(allowedOrigin => {
            if (typeof allowedOrigin === 'string') {
                return origin === allowedOrigin;
            }
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

app.options('*', cors());

app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
    req.blockchainSync = blockchainSync;
    next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/identity', identityRoutes);
app.use('/api/achievements', achievementRoutes);

// Blockchain sync endpoints
app.get('/api/blockchain/status', (req, res) => {
    try {
        const status = blockchainSync.getServiceStatus();
        res.json({
            success: true,
            data: status,
            message: status.ready ? 'Blockchain sync service is ready' : 'Blockchain sync service not ready'
        });
    } catch (error: any) {
        console.error('Blockchain status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get blockchain status',
            details: error.message
        });
    }
});

app.post('/api/blockchain/reinitialize', async (req, res) => {
    try {
        console.log('🔄 Manual blockchain service reinitialization requested');
        const success = await blockchainSync.reinitialize();

        if (success) {
            res.json({
                success: true,
                message: 'Blockchain sync service reinitialized successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to reinitialize blockchain sync service'
            });
        }
    } catch (error: any) {
        console.error('Blockchain reinit error:', error);
        res.status(500).json({
            success: false,
            error: 'Reinitialization failed',
            details: error.message
        });
    }
});

app.post('/api/blockchain/sync-all', async (req, res) => {
    try {
        console.log('🔄 Manual full blockchain sync requested');
        await blockchainSync.syncAllIdentities();

        res.json({
            success: true,
            message: 'Full blockchain sync completed successfully'
        });
    } catch (error: any) {
        console.error('Full sync error:', error);
        res.status(500).json({
            success: false,
            error: 'Full blockchain sync failed',
            details: error.message
        });
    }
});

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

        const blockchainIdentity = await blockchainSync.getBlockchainIdentity(address);

        if (blockchainIdentity) {
            res.json({
                success: true,
                data: blockchainIdentity,
                source: 'blockchain',
                message: 'Identity retrieved from blockchain'
            });
        } else {
            res.json({
                success: false,
                data: null,
                message: 'No identity found for this address'
            });
        }
    } catch (error: any) {
        console.error('SDK error:', error);
        res.status(500).json({
            success: false,
            error: 'SDK request failed',
            details: error.message
        });
    }
});

// Enhanced health check endpoint
app.get('/health', (req, res) => {
    const blockchainStatus = blockchainSync.getServiceStatus();

    const health = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
            database: 'Connected',
            realtime: realtimeService ? 'Active' : 'Inactive',
            nftService: dynamicNFTService ? 'Active' : 'Inactive',
            achievements: achievementService ? 'Active' : 'Inactive',
            verification: verificationService ? 'Active' : 'Inactive',
            blockchainSync: blockchainStatus.ready ? 'Ready' : 'Not Ready'
        },
        blockchain: {
            configValid: blockchainStatus.configValid,
            initialized: blockchainStatus.initialized,
            ready: blockchainStatus.ready,
            contractAddress: blockchainStatus.contractAddress,
            hasProvider: blockchainStatus.hasProvider,
            hasContract: blockchainStatus.hasContract
        },
        env: {
            nodeEnv: process.env.NODE_ENV || 'development',
            hasContract: !!process.env.CONTRACT_ADDRESS,
            contractAddress: process.env.CONTRACT_ADDRESS?.substring(0, 10) + '...',
            hasJWT: !!process.env.JWT_SECRET,
            hasMongoDB: !!process.env.MONGODB_URI,
            hasRPC: !!process.env.RPC_URL
        },
        version: '2.0.0'
    };

    const statusCode = blockchainStatus.ready ? 200 : 503;
    res.status(statusCode).json(health);
});

// API test endpoint
app.get('/api/test', (req, res) => {
    const blockchainStatus = blockchainSync.getServiceStatus();

    res.json({
        success: true,
        message: 'SomniaID API is working!',
        timestamp: new Date().toISOString(),
        blockchain: {
            status: blockchainStatus.ready ? 'Ready' : 'Not Ready',
            contract: blockchainStatus.contractAddress
        },
        features: [
            'Real-time updates',
            'Dynamic NFT metadata',
            'Achievement system',
            'Cross-platform SDK',
            'Live analytics',
            'Blockchain verification',
            'Token ID synchronization'
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
            'GET /health',
            'POST /api/identity',
            'GET /api/identity/:tokenId',
            'GET /api/identity/blockchain/:address',
            'POST /api/identity/sync-blockchain',
            'GET /api/achievements',
            'POST /api/achievements/create',
            'GET /api/blockchain/status',
            'POST /api/blockchain/reinitialize',
            'POST /api/blockchain/sync-all'
        ]
    });
});

// Enhanced error handling middleware
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

// FIXED: Validate environment on startup (removed incorrect contract address check)
const validateEnvironment = () => {
    console.log('🔍 Validating server environment...');

    const required = ['CONTRACT_ADDRESS', 'MONGODB_URI'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:', missing);
        console.error('   Create a .env file with these variables');
        return false;
    }

    // REMOVED: The incorrect old contract address check

    console.log('✅ Environment validation passed');
    console.log('   Contract Address:', process.env.CONTRACT_ADDRESS);
    return true;
};

// Initialize services after database connection
const initializeServices = () => {
    try {
        console.log('🚀 Initializing services...');

        realtimeService = new RealtimeService(io);
        dynamicNFTService = new DynamicNFTService();
        achievementService = new AchievementService(realtimeService);
        verificationService = new VerificationService();

        console.log('✅ All services initialized');

        // Check blockchain sync status
        const blockchainStatus = blockchainSync.getServiceStatus();
        if (blockchainStatus.ready) {
            console.log('✅ Blockchain sync service is ready');
        } else {
            console.log('⚠️  Blockchain sync service not ready');
            console.log('   Status:', blockchainStatus);

            // Try to reinitialize blockchain sync
            console.log('🔄 Attempting to reinitialize blockchain sync...');
            blockchainSync.reinitialize().then((success) => {
                if (success) {
                    console.log('✅ Blockchain sync reinitialized successfully');
                } else {
                    console.error('❌ Failed to reinitialize blockchain sync');
                }
            });
        }

        // Start background tasks
        setInterval(async () => {
            try {
                await achievementService.manualAchievementCheck(0, 'automated_check');
                await verificationService.runAutomatedVerification();
                await realtimeService.getRealtimeStats();
            } catch (error) {
                console.error('Background task error:', error);
            }
        }, 60000);

        console.log('🔄 Background tasks started');
    } catch (error) {
        console.error('❌ Service initialization error:', error);
    }
};

// Main initialization
async function startServer() {
    try {
        // Step 1: Validate environment
        const envValid = validateEnvironment();
        if (!envValid) {
            console.error('❌ Server startup failed: Environment validation failed');
            process.exit(1);
        }

        // Step 2: Connect to database
        console.log('🔗 Connecting to database...');
        await connectDB();
        console.log('✅ Database connected');

        // Step 3: Initialize services
        initializeServices();

        // Step 4: Start server
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

            // Show blockchain sync status
            const blockchainStatus = blockchainSync.getServiceStatus();
            console.log(`🔗 Blockchain Sync: ${blockchainStatus.ready ? '✅ Ready' : '⚠️  Not Ready'}`);
            console.log(`📄 Contract: ${blockchainStatus.contractAddress}`);

            console.log(`🔥 Real-time updates: ENABLED`);
            console.log(`🎯 Dynamic NFTs: ENABLED`);
            console.log(`🏆 Achievement system: ENABLED`);
            console.log(`🌐 Cross-platform SDK: ENABLED`);
            console.log(`📊 Live analytics: ENABLED`);
            console.log(`🔐 Blockchain verification: ENABLED`);
            console.log('🚀 =================================');

            console.log('🌐 Allowed CORS Origins:');
            allowedOrigins.forEach(origin => {
                console.log(`   - ${origin}`);
            });

            if (!blockchainStatus.ready) {
                console.log('⚠️  WARNING: Blockchain sync service not ready');
                console.log('   Some features may not work correctly');
                console.log('   Check your CONTRACT_ADDRESS and RPC_URL');
            }
        });

    } catch (error) {
        console.error('❌ Server startup failed:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('🛑 Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('🛑 Server closed');
        process.exit(0);
    });
});

// Start the server
startServer();

export default app;