import { ethers } from 'ethers';
import Identity from '../models/Identity';
import NFTTransfer from '../models/NFTTransfer';
import AchievementHistory from '../models/AchievementHistory';
import GoalProgress from '../models/GoalProgress';
import PriceHistory from '../models/PriceHistory';

// Get contract address from environment - EXPORTED for other files
export const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0xCf769a0f49507AFe6d7E4cADE715B9c4caa7158C';
const RPC_URL = process.env.RPC_URL || 'https://dream-rpc.somnia.network/';

// Enhanced ABI with all events we need to listen to - EXPORTED for other files
export const CONTRACT_ABI = [
    // View functions for reading data
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function getIdentity(uint256 tokenId) view returns (tuple(uint256 reputationScore, uint256 skillLevel, uint256 achievementCount, uint256 lastUpdate, string primarySkill, bool isVerified))',
    'function hasIdentity(address owner) view returns (bool)',
    'function getTokenIdByAddress(address owner) view returns (uint256)',
    'function getTotalIdentities() view returns (uint256)',
    'function getListingInfo(uint256 tokenId) view returns (bool isListed, uint256 price)',
    'function isListed(uint256 tokenId) view returns (bool)',

    // Contract info functions
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function balanceOf(address owner) view returns (uint256)',
    'function tokenURI(uint256 tokenId) view returns (string)',

    // Events for monitoring
    'event IdentityCreated(uint256 indexed tokenId, address indexed owner, string username)',
    'event IdentityPurchased(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price)',
    'event IdentityListed(uint256 indexed tokenId, uint256 price)',
    'event AchievementUnlocked(uint256 indexed tokenId, string title, uint256 points, uint256 priceImpact)',
    'event PriceUpdated(uint256 indexed tokenId, uint256 oldPrice, uint256 newPrice, string reason)',
    'event GoalCompleted(uint256 indexed tokenId, uint256 goalIndex, uint256 rewardPoints)',
    'event GoalFailed(uint256 indexed tokenId, uint256 goalIndex, uint256 pricePenalty)',
    'event ReputationUpdated(uint256 indexed tokenId, uint256 newScore, uint256 timestamp)',
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
];

// Create and export publicClient for viem-style interface compatibility
const provider = new ethers.JsonRpcProvider(RPC_URL);
export const publicClient = {
    readContract: async (params: {
        address: string;
        abi: any[];
        functionName: string;
        args?: any[];
    }) => {
        const contract = new ethers.Contract(params.address, params.abi, provider);
        return await contract[params.functionName](...(params.args || []));
    }
};

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

            console.log('🔗 FINAL Enhanced Blockchain Sync Service initialized:');
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

        console.log('🎧 Starting COMPREHENSIVE blockchain event listening...');

        try {
            // ========== CRITICAL: IdentityCreated Event Listener ==========
            const identityCreatedListener = this.contract.on('IdentityCreated', async (...args) => {
                console.log('🆕 RAW IdentityCreated event args:', args);

                let tokenId, owner, username, event;

                // Handle different event signatures flexibly
                if (args.length >= 4) {
                    [tokenId, owner, username, event] = args;
                } else if (args.length >= 3) {
                    [tokenId, owner, event] = args;
                    username = null;
                }

                console.log('🆕 Parsed IdentityCreated:', {
                    tokenId: tokenId?.toString(),
                    owner: owner,
                    username: username || 'NOT_PROVIDED_BY_CONTRACT',
                    txHash: event?.transactionHash
                });

                await this.handleIdentityCreated({
                    tokenId: Number(tokenId),
                    owner: owner.toLowerCase(),
                    username: username || null,
                    txHash: event?.transactionHash || '',
                    blockNumber: event?.blockNumber || 0,
                    timestamp: new Date()
                });
            });
            this.eventListeners.set('IdentityCreated', identityCreatedListener);

            // ========== CRITICAL: Transfer Event Handler ==========
            const transferListener = this.contract.on('Transfer', async (from, to, tokenId, event) => {
                // Skip mint transactions (from = 0x0)
                if (from === '0x0000000000000000000000000000000000000000') {
                    console.log('🎨 Mint event (skipping):', tokenId.toString());
                    return;
                }

                console.log('🔄 Transfer event:', {
                    tokenId: tokenId.toString(),
                    from: from.toLowerCase(),
                    to: to.toLowerCase(),
                    txHash: event.transactionHash
                });

                await this.handleNFTTransfer({
                    tokenId: Number(tokenId),
                    from: from.toLowerCase(),
                    to: to.toLowerCase(),
                    txHash: event.transactionHash,
                    blockNumber: event.blockNumber,
                    timestamp: new Date()
                });
            });
            this.eventListeners.set('Transfer', transferListener);

            // ========== IdentityPurchased Event ==========
            const purchaseListener = this.contract.on('IdentityPurchased', async (tokenId, buyer, seller, price, event) => {
                console.log('💰 IdentityPurchased event:', {
                    tokenId: tokenId.toString(),
                    buyer: buyer.toLowerCase(),
                    seller: seller.toLowerCase(),
                    price: ethers.formatEther(price),
                    txHash: event.transactionHash
                });

                await this.handleIdentityPurchased({
                    tokenId: Number(tokenId),
                    buyer: buyer.toLowerCase(),
                    seller: seller.toLowerCase(),
                    price: Number(ethers.formatEther(price)),
                    txHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });
            });
            this.eventListeners.set('IdentityPurchased', purchaseListener);

            // ========== IdentityListed Event ==========
            const listingListener = this.contract.on('IdentityListed', async (tokenId, price, event) => {
                console.log('🏷️ IdentityListed event:', {
                    tokenId: tokenId.toString(),
                    price: ethers.formatEther(price)
                });
                // Handle listing logic if needed
            });
            this.eventListeners.set('IdentityListed', listingListener);

            // ========== Other Event Listeners ==========
            const priceListener = this.contract.on('PriceUpdated', async (tokenId, oldPrice, newPrice, reason, event) => {
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

            const goalCompletedListener = this.contract.on('GoalCompleted', async (tokenId, goalIndex, rewardPoints, event) => {
                await this.handleGoalCompleted({
                    tokenId: Number(tokenId),
                    goalIndex: Number(goalIndex),
                    rewardPoints: Number(rewardPoints),
                    txHash: event.transactionHash,
                    timestamp: new Date()
                });
            });
            this.eventListeners.set('GoalCompleted', goalCompletedListener);

            const goalFailedListener = this.contract.on('GoalFailed', async (tokenId, goalIndex, pricePenalty, event) => {
                await this.handleGoalFailed({
                    tokenId: Number(tokenId),
                    goalIndex: Number(goalIndex),
                    pricePenalty: Number(pricePenalty),
                    txHash: event.transactionHash,
                    timestamp: new Date()
                });
            });
            this.eventListeners.set('GoalFailed', goalFailedListener);

            const reputationListener = this.contract.on('ReputationUpdated', async (tokenId, newScore, timestamp, event) => {
                await this.handleReputationUpdated({
                    tokenId: Number(tokenId),
                    newScore: Number(newScore),
                    timestamp: new Date(Number(timestamp) * 1000),
                    txHash: event.transactionHash
                });
            });
            this.eventListeners.set('ReputationUpdated', reputationListener);

            const achievementListener = this.contract.on('AchievementUnlocked', async (tokenId, title, points, priceImpact, event) => {
                await this.handleAchievementUnlocked({
                    tokenId: Number(tokenId),
                    title,
                    points: Number(points),
                    priceImpact: Number(priceImpact),
                    txHash: event.transactionHash,
                    timestamp: new Date()
                });
            });
            this.eventListeners.set('AchievementUnlocked', achievementListener);

            console.log('✅ COMPREHENSIVE event listening started');
            console.log(`   Active listeners: ${this.eventListeners.size}`);

        } catch (error) {
            console.error('❌ Error starting event listeners:', error);
        }
    }

    // ========== IDENTITY CREATION HANDLER ==========
    private async handleIdentityCreated(data: {
        tokenId: number;
        owner: string;
        username: string | null;
        txHash: string;
        blockNumber: number;
        timestamp: Date;
    }) {
        try {
            console.log(`🆕 Processing IdentityCreated: Token #${data.tokenId} for ${data.owner}`);

            // Check if identity exists by tokenId
            let identity = await Identity.findOne({ tokenId: data.tokenId });

            if (identity) {
                identity.username = data.username || `User #${data.tokenId}`;

                // Preserve username unless it's a placeholder
                const isPlaceholder = identity.username.startsWith('User #') ||
                    identity.username.startsWith('Identity #') ||
                    identity.username.startsWith('User') && /^\d+$/.test(identity.username.replace('User', ''));

                if (data.username && data.username !== 'NOT_PROVIDED_BY_CONTRACT' && isPlaceholder) {
                    console.log(`🔄 Updating placeholder: ${identity.username} → ${data.username}`);
                    identity.username = data.username;
                } else {
                    console.log(`⭐ Preserving username: ${identity.username}`);
                }

                identity.ownerAddress = data.owner.toLowerCase();
                identity.isVerified = true;
                identity.isOriginalOwner = true;
                identity.txHash = data.txHash;
                identity.lastUpdate = Date.now();

                await identity.save();
                console.log(`✅ Updated identity: ${identity.username}`);

            } else {
                // Create new identity
                console.log(`✨ Creating NEW identity for Token #${data.tokenId}`);

                let finalUsername = data.username && data.username !== 'NOT_PROVIDED_BY_CONTRACT'
                    ? data.username
                    : `User #${data.tokenId}`;

                // Handle username conflicts
                let attempt = 0;
                let usernameToTry = finalUsername;

                while (attempt < 3) {
                    const existingUser = await Identity.findOne({ username: usernameToTry });
                    if (!existingUser) {
                        finalUsername = usernameToTry;
                        break;
                    }

                    attempt++;
                    usernameToTry = `${finalUsername}_${data.tokenId}_${attempt}`;
                }

                identity = new Identity({
                    tokenId: data.tokenId,
                    username: finalUsername,
                    primarySkill: 'Blockchain Developer',
                    ownerAddress: data.owner.toLowerCase(),
                    experience: 'beginner',
                    reputationScore: 100,
                    skillLevel: 1,
                    achievementCount: 0,
                    isVerified: true,
                    isOriginalOwner: true, // CRITICAL: Mark as identity creator
                    nftBasePrice: 10,
                    currentPrice: 10,
                    profile: {
                        bio: 'Welcome to SomniaID! Your digital identity journey begins now.',
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
                console.log(`✅ Created identity: ${finalUsername} (ORIGINAL OWNER)`);
            }

            // Broadcast event
            if ((global as any).realtimeService) {
                (global as any).realtimeService.broadcastActivity({
                    type: 'identity_created',
                    tokenId: data.tokenId,
                    username: identity.username,
                    data: { owner: data.owner, txHash: data.txHash },
                    timestamp: new Date()
                });
            }

        } catch (error: any) {
            console.error('❌ Error in handleIdentityCreated:', error);
        }
    }

    // ========== NFT TRANSFER HANDLER (CRITICAL FOR PORTFOLIO) ==========
    private async handleNFTTransfer(data: {
        tokenId: number;
        from: string;
        to: string;
        txHash: string;
        blockNumber: number;
        timestamp: Date;
    }) {
        try {
            console.log(`🔄 Processing Transfer: Token #${data.tokenId} ${data.from} → ${data.to}`);

            // Record transfer for portfolio tracking
            const transfer = new NFTTransfer({
                token_id: data.tokenId,
                from_address: data.from,
                to_address: data.to,
                price: 0, // Will be updated by IdentityPurchased event
                tx_hash: data.txHash,
                block_number: data.blockNumber,
                transfer_type: 'transfer',
                timestamp: data.timestamp
            });
            await transfer.save();

            // ✅ FIXED: NEVER change identity ownership here
            // Identity ownership is only changed in the API routes when verified
            // This prevents the confusion between identity vs NFT ownership

            console.log(`✅ Transfer recorded: Token #${data.tokenId} (Portfolio investment tracked)`);

        } catch (error) {
            console.error('❌ Error handling NFT transfer:', error);
        }
    }

    // ========== IDENTITY PURCHASE HANDLER ==========
    private async handleIdentityPurchased(data: {
        tokenId: number;
        buyer: string;
        seller: string;
        price: number;
        txHash: string;
        blockNumber: number;
    }) {
        try {
            // Update transfer record with price
            await NFTTransfer.updateOne(
                { token_id: data.tokenId, tx_hash: data.txHash },
                {
                    $set: {
                        price: data.price,
                        transfer_type: 'sale'
                    }
                }
            );

            console.log(`💰 Purchase recorded: Token #${data.tokenId} for ${data.price} ETH`);

        } catch (error) {
            console.error('❌ Error handling purchase:', error);
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

            const identity = await Identity.findOne({ tokenId: data.tokenId });
            if (identity) {
                identity.reputationScore += data.points;
                identity.achievementCount += 1;
                identity.lastUpdate = Date.now();
                await identity.save();
            }

            console.log(`🏆 Achievement processed: ${data.title} (+${data.points} points)`);
        } catch (error) {
            console.error('❌ Error handling achievement:', error);
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
            const changePercent = data.oldPrice > 0 ? ((data.newPrice - data.oldPrice) / data.oldPrice) * 100 : 0;

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

            console.log(`💰 Price update: Token #${data.tokenId} ${changePercent.toFixed(1)}%`);
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

            const identity = await Identity.findOne({ tokenId: data.tokenId });
            if (identity) {
                identity.reputationScore += data.rewardPoints;
                identity.lastUpdate = Date.now();
                await identity.save();
            }

            console.log(`🎯 Goal completed: Token #${data.tokenId} (+${data.rewardPoints} points)`);
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
            await GoalProgress.updateOne(
                { token_id: data.tokenId, goal_index: data.goalIndex },
                {
                    $set: {
                        failed: true,
                        failed_at: data.timestamp
                    }
                }
            );

            const identity = await Identity.findOne({ tokenId: data.tokenId });
            if (identity && data.pricePenalty > 0) {
                const penaltyAmount = (identity.currentPrice * data.pricePenalty) / 10000;
                identity.currentPrice = Math.max(1, identity.currentPrice - penaltyAmount);
                identity.lastUpdate = Date.now();
                await identity.save();
            }

            console.log(`❌ Goal failed: Token #${data.tokenId} (-${data.pricePenalty}bp)`);
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

            console.log(`⭐ Reputation updated: Token #${data.tokenId} → ${data.newScore}`);
        } catch (error) {
            console.error('❌ Error handling reputation update:', error);
        }
    }

    private async testConnection(): Promise<boolean> {
        if (!this.configValid || !this.provider || !this.contract) {
            console.error('❌ Cannot test connection: Invalid configuration');
            return false;
        }

        try {
            console.log('🔍 Testing blockchain connection...');

            const blockNumber = await this.provider.getBlockNumber();
            console.log('✅ RPC connection successful. Block:', blockNumber);

            const name = await this.contract.name();
            const symbol = await this.contract.symbol();
            console.log(`✅ Contract connected: ${name} (${symbol})`);

            const totalIdentities = await this.contract.getTotalIdentities();
            console.log(`✅ Total identities: ${totalIdentities}`);

            return true;
        } catch (error) {
            console.error('❌ Connection test failed:', error);
            return false;
        }
    }

    // ========== PORTFOLIO & QUERY METHODS ==========
    async getPortfolioData(address: string) {
        try {
            // Get user's actual identity (created by them)
            const userIdentity = await Identity.findOne({
                ownerAddress: address.toLowerCase(),
                isOriginalOwner: true
            });

            // Get NFTs they own (bought from others)
            const portfolioTransfers = await NFTTransfer.find({
                to_address: address.toLowerCase(),
                from_address: { $ne: address.toLowerCase() }
            }).sort({ timestamp: -1 });

            // Get identity data for portfolio NFTs
            const portfolioTokenIds = portfolioTransfers.map(t => t.token_id);
            const portfolioIdentities = await Identity.find({
                tokenId: { $in: portfolioTokenIds }
            }).lean();

            return {
                userIdentity, // Their real identity
                portfolioNFTs: portfolioTransfers, // NFTs they bought
                portfolioIdentities, // Identity data for those NFTs
                totalPortfolioValue: portfolioTransfers.reduce((sum, t) => sum + t.price, 0)
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

    // ========== SYNC METHODS ==========
    async syncAllIdentities(): Promise<void> {
        console.log('🔄 Starting blockchain sync...');

        if (!this.checkServiceReady()) {
            throw new Error('Service not ready');
        }

        try {
            const blockchainData = await this.getAllBlockchainIdentities();
            console.log(`📊 Found ${blockchainData.length} blockchain identities`);

            const dbIdentities = await Identity.find({}).lean();
            console.log(`📊 Found ${dbIdentities.length} database identities`);

            let fixed = 0, errors = 0, unchanged = 0;

            for (const dbIdentity of dbIdentities) {
                try {
                    const blockchainMatch = blockchainData.find(
                        b => b.ownerAddress.toLowerCase() === dbIdentity.ownerAddress.toLowerCase()
                    );

                    if (blockchainMatch && dbIdentity.tokenId !== blockchainMatch.tokenId) {
                        await Identity.updateOne(
                            { _id: dbIdentity._id },
                            {
                                $set: {
                                    tokenId: blockchainMatch.tokenId,
                                    reputationScore: blockchainMatch.reputationScore,
                                    skillLevel: blockchainMatch.skillLevel,
                                    achievementCount: blockchainMatch.achievementCount,
                                    lastUpdate: blockchainMatch.lastUpdate,
                                    primarySkill: blockchainMatch.primarySkill,
                                    isVerified: blockchainMatch.isVerified,
                                    lastMetadataUpdate: Date.now()
                                }
                            }
                        );
                        fixed++;
                    } else {
                        unchanged++;
                    }
                } catch (error) {
                    errors++;
                }
            }

            console.log(`📊 SYNC COMPLETE: Fixed ${fixed}, Unchanged ${unchanged}, Errors ${errors}`);
        } catch (error: any) {
            console.error('❌ Sync failed:', error);
            throw error;
        }
    }

    private checkServiceReady(): boolean {
        return this.configValid && this.isInitialized && !!this.provider && !!this.contract;
    }

    private async getAllBlockchainIdentities(): Promise<any[]> {
        if (!this.contract) throw new Error('Contract not available');

        const identities = [];
        let tokenId = 0;
        let consecutiveFailures = 0;

        while (consecutiveFailures < 20) {
            try {
                const owner = await this.contract.ownerOf(tokenId);
                const identityData = await this.contract.getIdentity(tokenId);

                identities.push({
                    tokenId,
                    ownerAddress: owner.toLowerCase(),
                    reputationScore: Number(identityData.reputationScore),
                    skillLevel: Number(identityData.skillLevel),
                    achievementCount: Number(identityData.achievementCount),
                    lastUpdate: Number(identityData.lastUpdate),
                    primarySkill: identityData.primarySkill,
                    isVerified: identityData.isVerified
                });

                consecutiveFailures = 0;
            } catch (error) {
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

            const dbIdentity = await Identity.findOne({
                ownerAddress: address.toLowerCase(),
                isOriginalOwner: true
            });

            if (!dbIdentity) {
                return { correct: false, error: 'No identity found' };
            }

            const hasIdentity = await this.contract.hasIdentity(address);
            if (!hasIdentity) {
                return {
                    correct: false,
                    dbTokenId: dbIdentity.tokenId,
                    error: 'No blockchain identity'
                };
            }

            const blockchainTokenId = Number(await this.contract.getTokenIdByAddress(address));

            return {
                correct: dbIdentity.tokenId === blockchainTokenId,
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
                { ownerAddress: address.toLowerCase(), isOriginalOwner: true },
                {
                    $set: {
                        tokenId: blockchainTokenId,
                        reputationScore: Number(identityData.reputationScore),
                        skillLevel: Number(identityData.skillLevel),
                        achievementCount: Number(identityData.achievementCount),
                        lastUpdate: Number(identityData.lastUpdate),
                        primarySkill: identityData.primarySkill,
                        isVerified: identityData.isVerified,
                        lastMetadataUpdate: Date.now()
                    }
                }
            );

            return result.modifiedCount > 0;
        } catch (error: any) {
            console.error(`Error fixing token ID for ${address}:`, error);
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

            const dbIdentity = await Identity.findOne({
                tokenId,
                isOriginalOwner: true
            });

            return {
                tokenId,
                ownerAddress: owner.toLowerCase(),
                reputationScore: Number(identityData.reputationScore),
                skillLevel: Number(identityData.skillLevel),
                achievementCount: Number(identityData.achievementCount),
                lastUpdate: Number(identityData.lastUpdate),
                primarySkill: identityData.primarySkill,
                isVerified: identityData.isVerified,
                username: dbIdentity?.username || `Identity #${tokenId}`,
                source: 'blockchain'
            };

        } catch (error: any) {
            console.error('Error getting blockchain identity:', error);
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
        console.log('🔄 Reinitializing service...');

        this.eventListeners.forEach((listener, event) => {
            if (this.contract) {
                this.contract.off(event, listener);
            }
        });
        this.eventListeners.clear();

        this.configValid = this.validateConfiguration();
        if (!this.configValid) return false;

        try {
            this.provider = new ethers.JsonRpcProvider(RPC_URL);
            this.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.provider);

            const success = await this.testConnection();
            this.isInitialized = success;

            if (success) {
                this.startEventListening();
            }

            return success;
        } catch (error) {
            console.error('Reinitialization error:', error);
            return false;
        }
    }
}

export default new BlockchainSyncService();