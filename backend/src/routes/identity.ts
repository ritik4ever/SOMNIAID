import express, { Request, Response } from 'express';
import Identity from '../models/Identity';
import NFTTransfer from '../models/NFTTransfer';
import AchievementHistory from '../models/AchievementHistory';
import GoalProgress from '../models/GoalProgress';
import PriceHistory from '../models/PriceHistory';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import BlockchainSyncService from '../services/blockchain-sync';

const router = express.Router();

// ==================== EXISTING ROUTES (Enhanced) ====================

// Enhanced: Get all identities with optional blockchain verification
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const verifyBlockchain = req.query.verifyBlockchain === 'true';
        const skip = (page - 1) * limit;

        let identities = await Identity.find()
            .sort({ reputationScore: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Auto-fix token ID mismatches if verification requested
        if (verifyBlockchain) {
            console.log('🔍 Verifying blockchain sync for identities...');

            for (let i = 0; i < identities.length; i++) {
                const identity = identities[i];

                try {
                    const verification = await BlockchainSyncService.verifyAddressTokenId(identity.ownerAddress);

                    if (!verification.correct && verification.blockchainTokenId) {
                        console.log(`🔧 Auto-fixing token ID mismatch for ${identity.ownerAddress}`);

                        const fixed = await BlockchainSyncService.fixAddressTokenId(identity.ownerAddress);

                        if (fixed) {
                            identities[i] = {
                                ...identity,
                                tokenId: verification.blockchainTokenId,
                                lastMetadataUpdate: Date.now()
                            };
                        }
                    }
                } catch (syncError) {
                    console.error(`Sync error for ${identity.ownerAddress}:`, syncError);
                }
            }
        }

        const total = await Identity.countDocuments();

        res.json({
            success: true,
            identities,
            blockchainVerified: verifyBlockchain,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Error fetching identities:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch identities'
        });
    }
});



// Get portfolio data for an address
router.get('/blockchain/:address', async (req: Request, res: Response): Promise<void> => {
    try {
        const { address } = req.params;

        console.log(`🔍 Fetching identity for address: ${address}`);

        // Step 1: Check database first for username
        let dbIdentity = await Identity.findOne({ ownerAddress: address.toLowerCase() });

        // Step 2: Get blockchain data
        const blockchainIdentity = await BlockchainSyncService.getBlockchainIdentity(address);

        if (!blockchainIdentity) {
            console.log(`❌ No identity found on blockchain for: ${address}`);
            res.json({
                success: false,
                error: 'No identity found on blockchain for this address'
            });
            return;
        }

        // Step 3: If we have DB identity, use its username; otherwise use blockchain/fallback
        let finalUsername = `User #${blockchainIdentity.tokenId}`; // Fallback

        if (dbIdentity && dbIdentity.username) {
            finalUsername = dbIdentity.username;
            console.log(`✅ Using database username: ${finalUsername}`);
        } else if (blockchainIdentity.username && !blockchainIdentity.username.startsWith('Identity #')) {
            finalUsername = blockchainIdentity.username;
            console.log(`✅ Using blockchain username: ${finalUsername}`);
        }

        // Step 4: If no DB identity exists, create one
        if (!dbIdentity) {
            console.log(`📝 Creating database entry for Token #${blockchainIdentity.tokenId}`);

            try {
                dbIdentity = new Identity({
                    tokenId: blockchainIdentity.tokenId,
                    username: finalUsername,
                    primarySkill: blockchainIdentity.primarySkill,
                    ownerAddress: blockchainIdentity.ownerAddress,
                    experience: 'beginner',
                    reputationScore: blockchainIdentity.reputationScore,
                    skillLevel: blockchainIdentity.skillLevel,
                    achievementCount: blockchainIdentity.achievementCount,
                    isVerified: true, // Set to true since it's on blockchain
                    nftBasePrice: 10,
                    currentPrice: 10,
                    profile: {
                        bio: `Welcome ${finalUsername}! Your journey on SomniaID begins now.`,
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
                    lastUpdate: blockchainIdentity.lastUpdate || Date.now(),
                    lastMetadataUpdate: Date.now()
                });

                await dbIdentity.save();
                console.log(`✅ Created database entry for Token #${blockchainIdentity.tokenId}: ${finalUsername}`);
            } catch (createError: any) {
                console.error('Error creating database entry:', createError);
                // Continue with blockchain data even if DB creation fails
            }
        } else {
            // Update existing DB identity with blockchain data
            console.log(`📝 Updating existing database identity`);

            dbIdentity.tokenId = blockchainIdentity.tokenId;
            dbIdentity.reputationScore = blockchainIdentity.reputationScore;
            dbIdentity.skillLevel = blockchainIdentity.skillLevel;
            dbIdentity.achievementCount = blockchainIdentity.achievementCount;
            dbIdentity.isVerified = true; // Mark as verified
            dbIdentity.lastUpdate = blockchainIdentity.lastUpdate || Date.now();
            dbIdentity.updatedAt = new Date();

            try {
                await dbIdentity.save();
                console.log(`✅ Updated database identity: ${dbIdentity.username}`);
            } catch (updateError) {
                console.error('Error updating database identity:', updateError);
            }
        }

        // Step 5: Return merged identity with proper username
        const mergedIdentity = {
            tokenId: blockchainIdentity.tokenId,
            username: finalUsername, // THE REAL USERNAME
            primarySkill: blockchainIdentity.primarySkill,
            ownerAddress: blockchainIdentity.ownerAddress,
            reputationScore: blockchainIdentity.reputationScore,
            skillLevel: blockchainIdentity.skillLevel,
            achievementCount: blockchainIdentity.achievementCount,
            isVerified: true, // Always true if on blockchain
            lastUpdate: blockchainIdentity.lastUpdate,
            experience: dbIdentity?.experience || 'beginner',
            currentPrice: dbIdentity?.currentPrice || 10,
            basePrice: dbIdentity?.nftBasePrice || 10,
            priceMultiplier: 100, // Default multiplier
            profile: dbIdentity?.profile || {
                bio: '',
                skills: [],
                achievements: [],
                goals: [],
                socialLinks: {},
                education: [],
                workExperience: []
            },
            profileViews: dbIdentity?.profileViews || 0,
            followers: dbIdentity?.followers || [],
            following: dbIdentity?.following || [],
            txHash: dbIdentity?.txHash,
            createdAt: dbIdentity?.createdAt,
            source: 'blockchain-enhanced',
            blockchainVerified: true,
            dbSynced: true,
            syncedAt: new Date()
        };

        console.log(`✅ Returning identity: Token #${mergedIdentity.tokenId} → ${mergedIdentity.username}`);

        res.json({
            success: true,
            identity: mergedIdentity
        });

    } catch (error: unknown) {
        console.error('Blockchain lookup error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to lookup blockchain identity'
        });
    }
});

// Get enhanced identity data with history
router.get('/enhanced/:tokenId', async (req: Request, res: Response): Promise<void> => {
    try {
        const tokenId = parseInt(req.params.tokenId);

        if (isNaN(tokenId)) {
            res.status(400).json({
                success: false,
                error: 'Invalid token ID'
            });
            return;
        }

        // Get base identity
        const identity = await Identity.findOne({ tokenId }).lean();
        if (!identity) {
            res.status(404).json({
                success: false,
                error: 'Identity not found'
            });
            return;
        }

        // Get related data in parallel
        const [achievementHistory, goalProgress, priceHistory, transferHistory] = await Promise.all([
            AchievementHistory.find({ token_id: tokenId }).sort({ timestamp: -1 }).lean(),
            GoalProgress.find({ token_id: tokenId }).sort({ deadline: 1 }).lean(),
            PriceHistory.find({ token_id: tokenId }).sort({ timestamp: -1 }).limit(50).lean(),
            NFTTransfer.find({ token_id: tokenId }).sort({ timestamp: -1 }).lean()
        ]);

        // Calculate analytics
        const totalVolume = transferHistory.reduce((sum, t) => sum + t.price, 0);
        const priceChangePercent = priceHistory.length > 1
            ? ((priceHistory[0].new_price - priceHistory[priceHistory.length - 1].old_price) / priceHistory[priceHistory.length - 1].old_price) * 100
            : 0;

        const enhancedIdentity = {
            ...identity,
            achievementHistory,
            goalProgress,
            priceHistory,
            transferHistory,
            analytics: {
                totalVolume,
                priceChangePercent,
                averagePrice: totalVolume / Math.max(1, transferHistory.length),
                completedGoals: goalProgress.filter(g => g.completed).length,
                failedGoals: goalProgress.filter(g => g.failed).length,
                verifiedAchievements: achievementHistory.filter((a: any) => a.verified).length
            }
        };

        res.json({
            success: true,
            identity: enhancedIdentity
        });

    } catch (error) {
        console.error('Error fetching enhanced identity:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch enhanced identity data'
        });
    }
});

// ==================== EXISTING ROUTES (Keep as is) ====================

// Get identity with blockchain-first approach
router.get('/blockchain/:address', async (req: Request, res: Response): Promise<void> => {
    try {
        const { address } = req.params;

        console.log(`🔍 Universal blockchain lookup for address: ${address}`);

        const blockchainIdentity = await BlockchainSyncService.getBlockchainIdentity(address);

        if (!blockchainIdentity) {
            res.json({
                success: false,
                error: 'No identity found on blockchain for this address'
            });
            return;
        }

        let dbIdentity = await Identity.findOne({ ownerAddress: address.toLowerCase() });

        if (!dbIdentity) {
            console.log(`📝 Auto-creating database entry for Token #${blockchainIdentity.tokenId}`);

            try {
                dbIdentity = new Identity({
                    tokenId: blockchainIdentity.tokenId,
                    username: `User${blockchainIdentity.tokenId}`,
                    primarySkill: blockchainIdentity.primarySkill,
                    ownerAddress: blockchainIdentity.ownerAddress,
                    experience: 'beginner',
                    reputationScore: blockchainIdentity.reputationScore,
                    skillLevel: blockchainIdentity.skillLevel,
                    achievementCount: blockchainIdentity.achievementCount,
                    isVerified: true,
                    nftBasePrice: 10,
                    currentPrice: 10,
                    profile: {
                        bio: '',
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
                    lastUpdate: blockchainIdentity.lastUpdate || Date.now(),
                    lastMetadataUpdate: Date.now()
                });

                await dbIdentity.save();
                console.log(`✅ Auto-created database entry for Token #${blockchainIdentity.tokenId}`);
            } catch (createError) {
                console.error('Error auto-creating database entry:', createError);
            }
        }

        const mergedIdentity = {
            tokenId: blockchainIdentity.tokenId,
            ownerAddress: blockchainIdentity.ownerAddress,
            reputationScore: blockchainIdentity.reputationScore,
            skillLevel: blockchainIdentity.skillLevel,
            achievementCount: blockchainIdentity.achievementCount,
            lastUpdate: blockchainIdentity.lastUpdate,
            primarySkill: blockchainIdentity.primarySkill,
            isVerified: true,
            username: dbIdentity?.username || `User${blockchainIdentity.tokenId}`,
            experience: dbIdentity?.experience || 'beginner',
            profile: dbIdentity?.profile || {
                bio: '',
                skills: [],
                achievements: [],
                goals: [],
                socialLinks: {},
                education: [],
                workExperience: []
            },
            profileViews: dbIdentity?.profileViews || 0,
            followers: dbIdentity?.followers || [],
            following: dbIdentity?.following || [],
            txHash: dbIdentity?.txHash,
            createdAt: dbIdentity?.createdAt,
            source: 'blockchain',
            blockchainVerified: true,
            dbSynced: !!dbIdentity,
            syncedAt: new Date()
        };

        res.json({
            success: true,
            identity: mergedIdentity
        });

    } catch (error: unknown) {
        console.error('Universal blockchain lookup error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to lookup blockchain identity'
        });
    }
});

// Get identity by token ID
router.get('/:tokenId', async (req: Request, res: Response): Promise<void> => {
    try {
        const tokenId = parseInt(req.params.tokenId);

        if (isNaN(tokenId)) {
            res.status(400).json({
                success: false,
                error: 'Invalid token ID'
            });
            return;
        }

        const identity = await Identity.findOne({ tokenId });

        if (!identity) {
            res.status(404).json({
                success: false,
                error: 'Identity not found'
            });
            return;
        }

        res.json({
            success: true,
            identity: identity.toObject()
        });
    } catch (error: any) {
        console.error('Error fetching identity:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch identity'
        });
    }
});

// Route to check if token is listed
router.get('/listing/:tokenId', async (req: Request, res: Response): Promise<void> => {
    try {
        const tokenId = parseInt(req.params.tokenId);

        if (isNaN(tokenId)) {
            res.status(400).json({
                success: false,
                error: 'Invalid token ID'
            });
            return;
        }

        res.json({
            success: true,
            tokenId: tokenId,
            listed: false,
            price: "0"
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Debug endpoint
router.get('/debug/:tokenId/:address', async (req: Request, res: Response): Promise<void> => {
    try {
        const tokenId = parseInt(req.params.tokenId);
        const address = req.params.address;

        const blockchainIdentity = await BlockchainSyncService.getBlockchainIdentity(address);

        if (!blockchainIdentity) {
            res.json({
                success: false,
                error: 'No identity found on blockchain'
            });
            return;
        }

        res.json({
            success: true,
            debug: {
                tokenId: blockchainIdentity.tokenId,
                ownerAddress: blockchainIdentity.ownerAddress,
                contractAddress: process.env.CONTRACT_ADDRESS,
                message: 'Token found on blockchain. Check frontend for contract calls.'
            }
        });

    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create identity with proper token ID generation
router.post('/create', async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== CREATE IDENTITY WITH BLOCKCHAIN SYNC ===');
        const { username, primarySkill, bio, ownerAddress, txHash } = req.body;

        if (!username || !primarySkill) {
            res.status(400).json({
                success: false,
                error: 'Username and primary skill are required'
            });
            return;
        }

        const existingIdentity = await Identity.findOne({ username });
        if (existingIdentity) {
            res.status(400).json({
                success: false,
                error: 'Username already taken'
            });
            return;
        }

        let tokenId: number;

        if (ownerAddress && txHash) {
            console.log('🔍 Getting token ID from blockchain...');

            try {
                const blockchainIdentity = await BlockchainSyncService.getBlockchainIdentity(ownerAddress);

                if (blockchainIdentity) {
                    tokenId = blockchainIdentity.tokenId;
                    console.log(`✅ Using blockchain token ID: ${tokenId}`);
                } else {
                    tokenId = Math.floor(Date.now() / 1000);
                    console.log(`⚠️ Blockchain identity not found, using temporary ID: ${tokenId}`);
                }
            } catch (error) {
                console.error('Error fetching blockchain token ID:', error);
                tokenId = Math.floor(Date.now() / 1000);
            }
        } else {
            tokenId = Math.floor(Date.now() / 1000);
            console.log(`📝 Using temporary token ID: ${tokenId}`);
        }

        let profileData: any = {};
        if (bio && typeof bio === 'string' && bio.startsWith('{')) {
            try {
                profileData = JSON.parse(bio);
            } catch (parseError) {
                profileData = { profile: { bio: bio } };
            }
        } else {
            profileData = { profile: { bio: bio || '' } };
        }

        const identityData = {
            tokenId,
            username,
            primarySkill,
            ownerAddress: ownerAddress || `0x${Math.random().toString(16).substr(2, 40)}`,
            experience: profileData.experience || 'beginner',
            reputationScore: profileData.reputationScore || 100,
            skillLevel: profileData.skillLevel || 1,
            achievementCount: profileData.profile?.achievements?.length || 0,
            isVerified: !!txHash,
            currentPrice: 10,
            nftBasePrice: 10,
            profile: {
                bio: profileData.profile?.bio || '',
                skills: profileData.profile?.skills || [],
                achievements: profileData.profile?.achievements || [],
                goals: profileData.profile?.goals || [],
                socialLinks: profileData.profile?.socialLinks || {},
                education: profileData.profile?.education || [],
                workExperience: profileData.profile?.workExperience || []
            },
            profileViews: 0,
            followers: [],
            following: [],
            lastUpdate: Date.now(),
            txHash: txHash || null
        };

        const identity = new Identity(identityData);
        const savedIdentity = await identity.save();

        console.log(`✅ Identity created with token ID: ${tokenId}`);

        if (ownerAddress && txHash) {
            setTimeout(async () => {
                console.log('🔍 Verifying token ID sync...');
                const verification = await BlockchainSyncService.verifyAddressTokenId(ownerAddress);

                if (!verification.correct && verification.blockchainTokenId) {
                    console.log(`🔧 Post-creation token ID sync fix needed`);
                    await BlockchainSyncService.fixAddressTokenId(ownerAddress);
                }
            }, 10000);
        }

        res.json({
            success: true,
            identity: savedIdentity.toObject(),
            message: `Identity created successfully ${savedIdentity.isVerified ? 'and verified' : 'pending verification'}`
        });
    } catch (error: any) {
        console.error('❌ Error creating identity:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create identity'
        });
    }
});

// Manual sync endpoint
router.post('/sync-blockchain', async (req: Request, res: Response): Promise<void> => {
    try {
        const { address } = req.body;

        if (address) {
            const fixed = await BlockchainSyncService.fixAddressTokenId(address);

            res.json({
                success: true,
                message: fixed ? `Token ID synced for ${address}` : `No sync needed for ${address}`,
                fixed
            });
        } else {
            await BlockchainSyncService.syncAllIdentities();

            res.json({
                success: true,
                message: 'All identities synced with blockchain'
            });
        }
    } catch (error: any) {
        console.error('Sync error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Sync failed'
        });
    }
});

// Update identity
router.put('/:tokenId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tokenId = parseInt(req.params.tokenId);
        const updates = req.body;

        const identity = await Identity.findOneAndUpdate(
            { tokenId },
            {
                ...updates,
                lastUpdate: Date.now(),
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        );

        if (!identity) {
            res.status(404).json({
                success: false,
                error: 'Identity not found'
            });
            return;
        }

        res.json({
            success: true,
            identity: identity.toObject(),
            message: 'Identity updated successfully'
        });
    } catch (error: any) {
        console.error('Error updating identity:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update identity'
        });
    }
});

// Universal username update
router.put('/update-username', async (req: Request, res: Response): Promise<void> => {
    try {
        const { ownerAddress, username } = req.body;

        if (!ownerAddress || !username) {
            res.status(400).json({
                success: false,
                error: 'Owner address and username are required'
            });
            return;
        }

        const result = await Identity.updateOne(
            { ownerAddress: ownerAddress.toLowerCase() },
            {
                $set: {
                    username,
                    updatedAt: new Date()
                }
            }
        );

        if (result.modifiedCount > 0) {
            res.json({
                success: true,
                message: 'Username updated successfully'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Identity not found'
            });
        }

    } catch (error: any) {
        console.error('Error updating username:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update username'
        });
    }
});

// Delete identity
router.delete('/:tokenId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tokenId = parseInt(req.params.tokenId);

        const identity = await Identity.findOneAndDelete({ tokenId });

        if (!identity) {
            res.status(404).json({
                success: false,
                error: 'Identity not found'
            });
            return;
        }

        res.json({
            success: true,
            message: 'Identity deleted successfully'
        });
    } catch (error: any) {
        console.error('Error deleting identity:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete identity'
        });
    }
});

// Search identities
router.get('/search/:query', async (req: Request, res: Response): Promise<void> => {
    try {
        const { query } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const searchRegex = new RegExp(query, 'i');

        const identities = await Identity.find({
            $or: [
                { username: searchRegex },
                { primarySkill: searchRegex },
                { 'profile.skills': { $in: [searchRegex] } },
                { 'profile.bio': searchRegex }
            ]
        })
            .sort({ reputationScore: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await Identity.countDocuments({
            $or: [
                { username: searchRegex },
                { primarySkill: searchRegex },
                { 'profile.skills': { $in: [searchRegex] } },
                { 'profile.bio': searchRegex }
            ]
        });

        res.json({
            success: true,
            identities,
            query,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Error searching identities:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search identities'
        });
    }
});

export default router;