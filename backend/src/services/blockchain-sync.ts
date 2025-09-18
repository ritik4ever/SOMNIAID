import { ethers } from 'ethers';
import Identity from '../models/Identity';
import NFTTransfer from '../models/NFTTransfer';
import AchievementHistory from '../models/AchievementHistory';
import GoalProgress from '../models/GoalProgress';
import PriceHistory from '../models/PriceHistory';

// Get contract address from environment
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x6f2CC3Fb16894A19aa1eA275158F7dd4d345a983';
const RPC_URL = process.env.RPC_URL || 'https://dream-rpc.somnia.network/';

// Enhanced ABI with all events we need to listen to
const CONTRACT_ABI = [
    // View functions for reading data
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function getIdentity(uint256 tokenId) view returns (tuple(uint256 reputationScore, uint256 skillLevel, uint256 achievementCount, uint256 lastUpdate, string primarySkill, bool isVerified))',
    'function hasIdentity(address owner) view returns (bool)',
    'function getTokenIdByAddress(address owner) view returns (uint256)',
    'function getTotalIdentities() view returns (uint256)',
    'function getListedIdentities() view returns (uint256[], uint256[])',

    // Contract info functions
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function balanceOf(address owner) view returns (uint256)',
    'function tokenURI(uint256 tokenId) view returns (string)',

    // Events for monitoring
    'event IdentityCreated(uint256 indexed tokenId, address indexed owner, string username)',
    'event IdentityPurchased(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price)',
    'event AchievementUnlocked(uint256 indexed tokenId, string title, uint256 points, uint256 priceImpact)',
    'event PriceUpdated(uint256 indexed tokenId, uint256 oldPrice, uint256 newPrice, string reason)',
    'event GoalCompleted(uint256 indexed tokenId, uint256 goalIndex, uint256 rewardPoints)',
    'event GoalFailed(uint256 indexed tokenId, uint256 goalIndex, uint256 pricePenalty)',
    'event ReputationUpdated(uint256 indexed tokenId, uint256 newScore, uint256 timestamp)',
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
];

export class BlockchainSyncService {
    private provider?: ethers.JsonRpcProvider;
    private contract?: ethers.Contract;
    private isInitialized: boolean = false;
    private configValid: boolean = false;
    private eventListeners: Map<string, any> = new Map();

    constructor() {
        this.configValid = this.validateConfiguration();

        if (!this.configValid) {
            console.error('❌ BlockchainSyncService initialization failed due to configuration errors');
            return;
        }

        try {
            this.provider = new ethers.JsonRpcProvider(RPC_URL);
            this.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.provider);

            console.log('🔗 Enhanced Blockchain Sync Service initialized:');
            console.log('   Contract Address:', CONTRACT_ADDRESS);
            console.log('   RPC URL:', RPC_URL);

            this.testConnection().then((success) => {
                this.isInitialized = success;
                if (success) {
                    console.log('✅ Blockchain Sync Service ready');
                    this.startEventListening();
                } else {
                    console.error('❌ Blockchain Sync Service connection test failed');
                }
            });

        } catch (error) {
            console.error('❌ Failed to initialize Blockchain Sync Service:', error);
        }
    }

    private validateConfiguration(): boolean {
        console.log('🔍 Validating blockchain sync configuration...');

        if (!CONTRACT_ADDRESS) {
            console.error('❌ CONTRACT_ADDRESS environment variable not set!');
            return false;
        }

        console.log('✅ Contract address validated:', CONTRACT_ADDRESS);
        console.log('✅ RPC URL:', RPC_URL);
        return true;
    }



    private async startEventListening() {
        if (!this.contract) {
            console.error('❌ Cannot start event listening: Contract not available');
            return;
        }

        console.log('🎧 Starting enhanced blockchain event listening...');

        try {
            // ========== CRITICAL: IdentityCreated Event Listener ==========
            const identityCreatedListener = this.contract.on('IdentityCreated', async (tokenId, owner, username, event) => {
                console.log('🆕 IdentityCreated event:', {
                    tokenId: tokenId.toString(),
                    owner,
                    username,
                    txHash: event.transactionHash
                });

                await this.handleIdentityCreated({
                    tokenId: Number(tokenId),
                    owner: owner.toLowerCase(),
                    username: username, // ⭐ ACTUAL USERNAME FROM BLOCKCHAIN
                    txHash: event.transactionHash,
                    blockNumber: event.blockNumber,
                    timestamp: new Date()
                });
            });
            this.eventListeners.set('IdentityCreated', identityCreatedListener);

            // Listen for PriceUpdated events - REAL-TIME PRICE CHANGES
            const priceListener = this.contract.on('PriceUpdated', async (tokenId, oldPrice, newPrice, reason, event) => {
                console.log('💰 PriceUpdated event:', {
                    tokenId: tokenId.toString(),
                    oldPrice: ethers.formatEther(oldPrice),
                    newPrice: ethers.formatEther(newPrice),
                    reason
                });

                await this.handlePriceUpdated({
                    tokenId: Number(tokenId),
                    oldPrice: Number(ethers.formatEther(oldPrice)),
                    newPrice: Number(ethers.formatEther(newPrice)),
                    reason,
                    txHash: event.transactionHash,
                    timestamp: new Date()
                });
            });
            this.eventListeners.set('PriceUpdated', priceListener);

            // Listen for GoalCompleted events - PRICE REWARDS
            const goalCompletedListener = this.contract.on('GoalCompleted', async (tokenId, goalIndex, rewardPoints, event) => {
                console.log('🎯 GoalCompleted event:', { tokenId: tokenId.toString(), goalIndex: goalIndex.toString(), rewardPoints: rewardPoints.toString() });

                await this.handleGoalCompleted({
                    tokenId: Number(tokenId),
                    goalIndex: Number(goalIndex),
                    rewardPoints: Number(rewardPoints),
                    txHash: event.transactionHash,
                    timestamp: new Date()
                });
            });
            this.eventListeners.set('GoalCompleted', goalCompletedListener);

            // Listen for GoalFailed events - PRICE PENALTIES
            const goalFailedListener = this.contract.on('GoalFailed', async (tokenId, goalIndex, pricePenalty, event) => {
                console.log('❌ GoalFailed event:', { tokenId: tokenId.toString(), goalIndex: goalIndex.toString(), pricePenalty: pricePenalty.toString() });

                await this.handleGoalFailed({
                    tokenId: Number(tokenId),
                    goalIndex: Number(goalIndex),
                    pricePenalty: Number(pricePenalty),
                    txHash: event.transactionHash,
                    timestamp: new Date()
                });
            });
            this.eventListeners.set('GoalFailed', goalFailedListener);

            // Listen for ReputationUpdated events
            const reputationListener = this.contract.on('ReputationUpdated', async (tokenId, newScore, timestamp, event) => {
                console.log('⭐ ReputationUpdated event:', { tokenId: tokenId.toString(), newScore: newScore.toString() });

                await this.handleReputationUpdated({
                    tokenId: Number(tokenId),
                    newScore: Number(newScore),
                    timestamp: new Date(Number(timestamp) * 1000),
                    txHash: event.transactionHash
                });
            });
            this.eventListeners.set('ReputationUpdated', reputationListener);

            console.log('✅ Blockchain event listening started successfully');
            console.log(`   Listening for ${this.eventListeners.size} event types`);

            console.log('✅ Enhanced event listening started with username capture');

        } catch (error) {
            console.error('❌ Error starting enhanced event listeners:', error);
        }
    }

    private async handleIdentityCreated(data: {
        tokenId: number;
        owner: string;
        username: string;
        txHash: string;
        blockNumber: number;
        timestamp: Date;
    }) {
        try {
            console.log(`🆕 Processing IdentityCreated: Token #${data.tokenId} → ${data.username} (${data.owner})`);

            // Check if identity already exists by tokenId (primary key)
            let identity = await Identity.findOne({ tokenId: data.tokenId });

            if (identity) {
                console.log(`📝 Updating existing identity ${identity.tokenId} with blockchain data`);

                // Update existing identity - keep existing username to avoid conflicts
                identity.ownerAddress = data.owner.toLowerCase();
                identity.isVerified = true; // Mark as verified since it's on blockchain
                identity.txHash = data.txHash;
                identity.lastUpdate = Date.now();
                identity.updatedAt = new Date();

                // Only update username if it's currently a placeholder
                if (identity.username.startsWith('User') || identity.username.startsWith('Identity #')) {
                    try {
                        identity.username = data.username;
                    } catch (usernameError: any) {
                        // If username conflict, keep the existing one
                        console.log(`⚠️ Keeping existing username due to conflict: ${identity.username}`);
                    }
                }

                await identity.save();
                console.log(`✅ Updated identity ${data.tokenId}: ${identity.username}`);

            } else {
                // Check if username already exists before creating
                const existingUser = await Identity.findOne({ username: data.username });

                if (existingUser) {
                    console.log(`⚠️ Username "${data.username}" already exists for token ${existingUser.tokenId}`);
                    console.log(`🔧 Creating identity with modified username`);

                    // Create with modified username to avoid conflict
                    const modifiedUsername = `${data.username}_${data.tokenId}`;

                    identity = new Identity({
                        tokenId: data.tokenId,
                        username: modifiedUsername, // Use modified username
                        primarySkill: 'Blockchain Developer',
                        ownerAddress: data.owner.toLowerCase(),
                        experience: 'beginner',
                        reputationScore: 100,
                        skillLevel: 1,
                        achievementCount: 0,
                        isVerified: true,
                        nftBasePrice: 10,
                        currentPrice: 10,
                        profile: {
                            bio: `Welcome ${data.username}! Your journey on SomniaID begins now.`,
                            skills: [],
                            achievements: [],
                            goals: [],
                            socialLinks: {},
                            education: [],
                            workExperience: []
                        },
                        profileViews: 0,
                        followers: [],
                        following: [],
                        lastUpdate: Date.now(),
                        txHash: data.txHash,
                        createdAt: new Date(),
                        lastMetadataUpdate: Date.now()
                    });
                } else {
                    // Create new identity with original username
                    console.log(`✨ Creating new identity from blockchain event`);

                    identity = new Identity({
                        tokenId: data.tokenId,
                        username: data.username, // Original username
                        primarySkill: 'Blockchain Developer',
                        ownerAddress: data.owner.toLowerCase(),
                        experience: 'beginner',
                        reputationScore: 100,
                        skillLevel: 1,
                        achievementCount: 0,
                        isVerified: true,
                        nftBasePrice: 10,
                        currentPrice: 10,
                        profile: {
                            bio: `Welcome ${data.username}! Your journey on SomniaID begins now.`,
                            skills: [],
                            achievements: [],
                            goals: [],
                            socialLinks: {},
                            education: [],
                            workExperience: []
                        },
                        profileViews: 0,
                        followers: [],
                        following: [],
                        lastUpdate: Date.now(),
                        txHash: data.txHash,
                        createdAt: new Date(),
                        lastMetadataUpdate: Date.now()
                    });
                }

                await identity.save();
                console.log(`✅ Created identity: Token #${data.tokenId} → ${identity.username}`);
            }

            // Emit real-time event for frontend
            if ((global as any).realtimeService) {
                (global as any).realtimeService.broadcastActivity({
                    type: 'identity_created',
                    tokenId: data.tokenId,
                    username: identity.username, // Use the actual saved username
                    data: { owner: data.owner, txHash: data.txHash },
                    timestamp: new Date()
                });
            }

        } catch (error: any) {
            console.error('❌ Error handling IdentityCreated event:', error);

            // If it's still a username conflict, try one more time with timestamp suffix
            if (error.code === 11000 && error.keyValue?.username) {
                try {
                    console.log(`🔧 Final attempt with timestamp suffix`);

                    const timestampSuffix = Date.now().toString().slice(-4);
                    const fallbackUsername = `${data.username}_${timestampSuffix}`;

                    const identity = new Identity({
                        tokenId: data.tokenId,
                        username: fallbackUsername,
                        primarySkill: 'Blockchain Developer',
                        ownerAddress: data.owner.toLowerCase(),
                        experience: 'beginner',
                        reputationScore: 100,
                        skillLevel: 1,
                        achievementCount: 0,
                        isVerified: true,
                        nftBasePrice: 10,
                        currentPrice: 10,
                        profile: {
                            bio: `Welcome ${data.username}! Your journey on SomniaID begins now.`,
                            skills: [],
                            achievements: [],
                            goals: [],
                            socialLinks: {},
                            education: [],
                            workExperience: []
                        },
                        profileViews: 0,
                        followers: [],
                        following: [],
                        lastUpdate: Date.now(),
                        txHash: data.txHash,
                        createdAt: new Date(),
                        lastMetadataUpdate: Date.now()
                    });

                    await identity.save();
                    console.log(`✅ Created with fallback username: ${fallbackUsername}`);
                } catch (finalError) {
                    console.error('❌ Final creation attempt failed:', finalError);
                }
            }
        }
    }
    private async handleIdentityPurchased(data: {
        tokenId: number;
        buyer: string;
        seller: string;
        price: number;
        txHash: string;
        blockNumber: number;
    }) {
        try {
            // 1. Record NFT transfer
            const transfer = new NFTTransfer({
                token_id: data.tokenId,
                from_address: data.seller.toLowerCase(),
                to_address: data.buyer.toLowerCase(),
                price: data.price,
                tx_hash: data.txHash,
                block_number: data.blockNumber,
                transfer_type: 'sale',
                timestamp: new Date()
            });
            await transfer.save();

            // 2. Update Identity ownership
            await Identity.updateOne(
                { tokenId: data.tokenId },
                {
                    $set: {
                        ownerAddress: data.buyer.toLowerCase(),
                        lastUpdate: Date.now(),
                        updatedAt: new Date()
                    }
                }
            );

            console.log(`✅ Identity purchase processed: Token #${data.tokenId} → ${data.buyer}`);

        } catch (error) {
            console.error('❌ Error handling identity purchase:', error);
        }
    }

    private async handleAchievementUnlocked(data: {
        tokenId: number;
        title: string;
        points: number;
        priceImpact: number;
        txHash: string;
        timestamp: Date;
    }) {
        try {
            // 1. Record achievement history
            const achievement = new AchievementHistory({
                token_id: data.tokenId,
                title: data.title,
                description: `Achievement unlocked: ${data.title}`,
                points: data.points,
                price_impact: data.priceImpact,
                category: 'milestone',
                tx_hash: data.txHash,
                timestamp: data.timestamp,
                verified: true
            });
            await achievement.save();

            // 2. Update Identity stats
            const identity = await Identity.findOne({ tokenId: data.tokenId });
            if (identity) {
                identity.reputationScore += data.points;
                identity.achievementCount += 1;
                identity.lastUpdate = Date.now();
                await identity.save();
            }

            console.log(`🏆 Achievement processed: ${data.title} (+${data.points} points)`);

        } catch (error) {
            console.error('❌ Error handling achievement unlock:', error);
        }
    }

    private async handlePriceUpdated(data: {
        tokenId: number;
        oldPrice: number;
        newPrice: number;
        reason: string;
        txHash: string;
        timestamp: Date;
    }) {
        try {
            const changePercent = ((data.newPrice - data.oldPrice) / data.oldPrice) * 100;

            // 1. Record price history
            const priceHistory = new PriceHistory({
                token_id: data.tokenId,
                old_price: data.oldPrice,
                new_price: data.newPrice,
                price_change_percent: changePercent,
                change_reason: data.reason,
                tx_hash: data.txHash,
                triggered_by: 'market',
                timestamp: data.timestamp
            });
            await priceHistory.save();

            // 2. Update Identity current price
            await Identity.updateOne(
                { tokenId: data.tokenId },
                {
                    $set: {
                        currentPrice: data.newPrice,
                        lastUpdate: Date.now(),
                        updatedAt: new Date()
                    }
                }
            );

            console.log(`💰 Price update processed: Token #${data.tokenId} ${changePercent.toFixed(1)}%`);

        } catch (error) {
            console.error('❌ Error handling price update:', error);
        }
    }

    private async handleGoalCompleted(data: {
        tokenId: number;
        goalIndex: number;
        rewardPoints: number;
        txHash: string;
        timestamp: Date;
    }) {
        try {
            // 1. Update goal progress
            await GoalProgress.updateOne(
                { token_id: data.tokenId, goal_index: data.goalIndex },
                {
                    $set: {
                        completed: true,
                        completed_at: data.timestamp,
                        current_progress: 100
                    }
                }
            );

            // 2. Update Identity reputation
            const identity = await Identity.findOne({ tokenId: data.tokenId });
            if (identity) {
                identity.reputationScore += data.rewardPoints;
                identity.lastUpdate = Date.now();
                await identity.save();
            }

            console.log(`🎯 Goal completion processed: Token #${data.tokenId} (+${data.rewardPoints} points)`);

        } catch (error) {
            console.error('❌ Error handling goal completion:', error);
        }
    }

    private async handleGoalFailed(data: {
        tokenId: number;
        goalIndex: number;
        pricePenalty: number;
        txHash: string;
        timestamp: Date;
    }) {
        try {
            // 1. Update goal progress
            await GoalProgress.updateOne(
                { token_id: data.tokenId, goal_index: data.goalIndex },
                {
                    $set: {
                        failed: true,
                        failed_at: data.timestamp
                    }
                }
            );

            // 2. Apply price penalty (if applicable)
            const identity = await Identity.findOne({ tokenId: data.tokenId });
            if (identity && data.pricePenalty > 0) {
                const penaltyAmount = (identity.currentPrice * data.pricePenalty) / 10000; // basis points
                identity.currentPrice = Math.max(1, identity.currentPrice - penaltyAmount);
                identity.lastUpdate = Date.now();
                await identity.save();
            }

            console.log(`❌ Goal failure processed: Token #${data.tokenId} (-${data.pricePenalty}bp)`);

        } catch (error) {
            console.error('❌ Error handling goal failure:', error);
        }
    }

    private async handleReputationUpdated(data: {
        tokenId: number;
        newScore: number;
        timestamp: Date;
        txHash: string;
    }) {
        try {
            await Identity.updateOne(
                { tokenId: data.tokenId },
                {
                    $set: {
                        reputationScore: data.newScore,
                        lastUpdate: data.timestamp.getTime(),
                        updatedAt: new Date()
                    }
                }
            );

            console.log(`⭐ Reputation update processed: Token #${data.tokenId} → ${data.newScore}`);

        } catch (error) {
            console.error('❌ Error handling reputation update:', error);
        }
    }

    // ==================== EXISTING METHODS (Enhanced) ====================

    private async testConnection(): Promise<boolean> {
        if (!this.configValid || !this.provider || !this.contract) {
            console.error('❌ Cannot test connection: Invalid configuration');
            return false;
        }

        try {
            console.log('🔍 Testing enhanced blockchain connection...');

            const blockNumber = await this.provider.getBlockNumber();
            console.log('✅ RPC connection successful. Latest block:', blockNumber);

            const name = await this.contract.name();
            const symbol = await this.contract.symbol();
            console.log(`✅ Connected to contract: ${name} (${symbol})`);

            const totalIdentities = await this.contract.getTotalIdentities();
            console.log(`✅ Contract functionality verified. Total identities: ${totalIdentities}`);

            console.log('🎉 Enhanced connection tests passed!');
            return true;

        } catch (error) {
            console.error('❌ Enhanced connection test failed:', error);
            return false;
        }
    }

    // ==================== NEW: ENHANCED QUERY METHODS ====================

    async getPortfolioData(address: string) {
        try {
            const transfers = await NFTTransfer.find({
                to_address: address.toLowerCase()
            }).sort({ timestamp: -1 });

            const tokenIds = transfers.map(t => t.token_id);

            const identities = await Identity.find({
                tokenId: { $in: tokenIds }
            }).lean();

            return {
                transfers,
                identities,
                totalValue: transfers.reduce((sum, t) => sum + t.price, 0)
            };
        } catch (error) {
            console.error('Error getting portfolio data:', error);
            return null;
        }
    }

    async getPriceHistory(tokenId: number, days: number = 30) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        return PriceHistory.find({
            token_id: tokenId,
            timestamp: { $gte: cutoff }
        }).sort({ timestamp: -1 });
    }

    async getAchievementHistory(tokenId: number) {
        return AchievementHistory.find({
            token_id: tokenId
        }).sort({ timestamp: -1 });
    }

    // ==================== EXISTING METHODS (Keep as is) ====================

    async syncAllIdentities(): Promise<void> {
        // Keep existing implementation...
        console.log('🔄 Starting complete blockchain sync...');

        if (!this.checkServiceReady()) {
            throw new Error('Blockchain sync service not ready. Check configuration.');
        }

        try {
            const blockchainData = await this.getAllBlockchainIdentities();
            console.log(`📊 Found ${blockchainData.length} identities on blockchain`);

            if (blockchainData.length === 0) {
                console.log('⚠️ No identities found on blockchain');
                return;
            }

            const dbIdentities = await Identity.find({}).lean();
            console.log(`📊 Found ${dbIdentities.length} identities in database`);

            const blockchainByAddress = new Map();
            blockchainData.forEach(identity => {
                blockchainByAddress.set(identity.ownerAddress.toLowerCase(), identity);
            });

            let fixed = 0;
            let errors = 0;
            let unchanged = 0;

            for (const dbIdentity of dbIdentities) {
                try {
                    const blockchainIdentity = blockchainByAddress.get(dbIdentity.ownerAddress.toLowerCase());

                    if (!blockchainIdentity) {
                        continue;
                    }

                    if (dbIdentity.tokenId !== blockchainIdentity.tokenId) {
                        const updateResult = await Identity.updateOne(
                            { _id: dbIdentity._id },
                            {
                                $set: {
                                    tokenId: blockchainIdentity.tokenId,
                                    reputationScore: blockchainIdentity.reputationScore,
                                    skillLevel: blockchainIdentity.skillLevel,
                                    achievementCount: blockchainIdentity.achievementCount,
                                    lastUpdate: blockchainIdentity.lastUpdate,
                                    primarySkill: blockchainIdentity.primarySkill,
                                    isVerified: blockchainIdentity.isVerified,
                                    lastMetadataUpdate: Date.now(),
                                    updatedAt: new Date()
                                }
                            }
                        );

                        if (updateResult.modifiedCount > 0) {
                            fixed++;
                        }
                    } else {
                        unchanged++;
                    }
                } catch (error) {
                    errors++;
                }
            }

            console.log('\n=====================================');
            console.log('📊 SYNC SUMMARY:');
            console.log(`   ✅ Fixed: ${fixed} identities`);
            console.log(`   ✅ Already correct: ${unchanged} identities`);
            console.log(`   ❌ Errors: ${errors} identities`);

        } catch (error: any) {
            console.error('❌ Blockchain sync failed:', error);
            throw error;
        }
    }

    private checkServiceReady(): boolean {
        return this.configValid && this.isInitialized && !!this.provider && !!this.contract;
    }

    private async getAllBlockchainIdentities(): Promise<any[]> {
        if (!this.checkServiceReady() || !this.contract) {
            throw new Error('Service not ready for blockchain queries');
        }

        const identities = [];
        let tokenId = 1;
        let consecutiveFailures = 0;
        const maxConsecutiveFailures = 20;

        while (consecutiveFailures < maxConsecutiveFailures) {
            try {
                const owner = await this.contract.ownerOf(tokenId);
                const identityData = await this.contract.getIdentity(tokenId);

                const identity = {
                    tokenId: tokenId,
                    ownerAddress: owner.toLowerCase(),
                    reputationScore: Number(identityData.reputationScore),
                    skillLevel: Number(identityData.skillLevel),
                    achievementCount: Number(identityData.achievementCount),
                    lastUpdate: Number(identityData.lastUpdate),
                    primarySkill: identityData.primarySkill,
                    isVerified: identityData.isVerified
                };

                identities.push(identity);
                consecutiveFailures = 0;

            } catch (error: any) {
                consecutiveFailures++;
            }

            tokenId++;
        }

        return identities;
    }

    async verifyAddressTokenId(address: string): Promise<{ correct: boolean, dbTokenId?: number, blockchainTokenId?: number, error?: string }> {
        try {
            if (!this.checkServiceReady() || !this.contract) {
                return { correct: false, error: 'Service not ready' };
            }

            const dbIdentity = await Identity.findOne({ ownerAddress: address.toLowerCase() });
            if (!dbIdentity) {
                return { correct: false, error: 'No database identity found' };
            }

            const hasIdentity = await this.contract.hasIdentity(address);
            if (!hasIdentity) {
                return {
                    correct: false,
                    dbTokenId: dbIdentity.tokenId,
                    error: 'No blockchain identity found'
                };
            }

            const blockchainTokenId = Number(await this.contract.getTokenIdByAddress(address));
            const isCorrect = dbIdentity.tokenId === blockchainTokenId;

            return {
                correct: isCorrect,
                dbTokenId: dbIdentity.tokenId,
                blockchainTokenId
            };

        } catch (error: any) {
            return { correct: false, error: error.message };
        }
    }

    async fixAddressTokenId(address: string): Promise<boolean> {
        try {
            if (!this.checkServiceReady() || !this.contract) return false;

            const hasIdentity = await this.contract.hasIdentity(address);
            if (!hasIdentity) return false;

            const blockchainTokenId = Number(await this.contract.getTokenIdByAddress(address));
            const identityData = await this.contract.getIdentity(blockchainTokenId);

            const result = await Identity.updateOne(
                { ownerAddress: address.toLowerCase() },
                {
                    $set: {
                        tokenId: blockchainTokenId,
                        reputationScore: Number(identityData.reputationScore),
                        skillLevel: Number(identityData.skillLevel),
                        achievementCount: Number(identityData.achievementCount),
                        lastUpdate: Number(identityData.lastUpdate),
                        primarySkill: identityData.primarySkill,
                        isVerified: identityData.isVerified,
                        lastMetadataUpdate: Date.now(),
                        updatedAt: new Date()
                    }
                }
            );

            return result.modifiedCount > 0 || result.matchedCount > 0;

        } catch (error: any) {
            console.error(`❌ Error fixing token ID for ${address}:`, error);
            return false;
        }
    }

    async getBlockchainIdentity(address: string): Promise<any | null> {
        try {
            if (!this.checkServiceReady() || !this.contract) return null;

            const hasIdentity = await this.contract.hasIdentity(address);
            if (!hasIdentity) return null;

            const tokenId = Number(await this.contract.getTokenIdByAddress(address));
            const owner = await this.contract.ownerOf(tokenId);
            const identityData = await this.contract.getIdentity(tokenId);

            // Check if we have this identity in database with username
            const dbIdentity = await Identity.findOne({ tokenId });

            return {
                tokenId,
                ownerAddress: owner.toLowerCase(),
                reputationScore: Number(identityData.reputationScore),
                skillLevel: Number(identityData.skillLevel),
                achievementCount: Number(identityData.achievementCount),
                lastUpdate: Number(identityData.lastUpdate),
                primarySkill: identityData.primarySkill,
                isVerified: identityData.isVerified,
                username: dbIdentity?.username || `Identity #${tokenId}`, // ⭐ Use DB username if available
                source: 'blockchain',
                synced: true
            };

        } catch (error: any) {
            console.error('❌ Error getting blockchain identity:', error);
            return null;
        }
    }

    getServiceStatus() {
        return {
            configValid: this.configValid,
            initialized: this.isInitialized,
            ready: this.checkServiceReady(),
            contractAddress: CONTRACT_ADDRESS,
            rpcUrl: RPC_URL,
            hasProvider: !!this.provider,
            hasContract: !!this.contract,
            eventListenersActive: this.eventListeners.size
        };
    }

    async reinitialize() {
        console.log('🔄 Force reinitializing Enhanced Blockchain Sync Service...');

        this.configValid = this.validateConfiguration();
        if (!this.configValid) return false;

        try {
            // Stop existing listeners
            this.eventListeners.forEach((listener, event) => {
                if (this.contract) {
                    this.contract.off(event, listener);
                }
            });
            this.eventListeners.clear();

            this.provider = new ethers.JsonRpcProvider(RPC_URL);
            this.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.provider);

            const connectionSuccess = await this.testConnection();
            this.isInitialized = connectionSuccess;

            if (connectionSuccess) {
                this.startEventListening();
            }

            return connectionSuccess;
        } catch (error) {
            console.error('❌ Reinitialization error:', error);
            return false;
        }
    }
}

export default new BlockchainSyncService();