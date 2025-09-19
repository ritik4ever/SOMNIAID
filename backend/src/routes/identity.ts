import express, { Request, Response } from 'express';
import Identity from '../models/Identity';
import NFTTransfer from '../models/NFTTransfer';
import AchievementHistory from '../models/AchievementHistory';
import GoalProgress from '../models/GoalProgress';
import PriceHistory from '../models/PriceHistory';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import BlockchainSyncService from '../services/blockchain-sync';
import { parseEther } from 'ethers';

// ADD THESE MISSING IMPORTS:
import { publicClient, CONTRACT_ADDRESS, CONTRACT_ABI } from '../services/blockchain-sync';

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

// FIXED: Single blockchain identity lookup with proper username handling
router.get('/blockchain/:address', async (req: Request, res: Response): Promise<void> => {
    try {
        const { address } = req.params;
        console.log(`🔍 Getting identity with USERNAME for address: ${address}`);

        // Step 1: Check if this address has their OWN identity on blockchain
        const hasIdentity = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'hasIdentity',
            args: [address]
        }) as boolean;

        if (!hasIdentity) {
            console.log(`❌ Address ${address} has NO identity on blockchain`);
            res.json({
                success: false,
                error: 'This address has no identity on the blockchain'
            });
            return;
        }

        // Step 2: Get their token ID from blockchain
        const tokenId = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getTokenIdByAddress',
            args: [address]
        }) as bigint;

        console.log(`✅ Address ${address} has blockchain identity Token #${tokenId}`);

        // Step 3: PRIORITY: Get identity from DATABASE first (for real username)
        let dbIdentity = await Identity.findOne({
            tokenId: Number(tokenId),
            ownerAddress: address.toLowerCase()
        });

        // Step 4: Get blockchain data for verification
        const blockchainData = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getIdentity',
            args: [tokenId]
        }) as any;

        // Step 5: If no database entry, create one but try to preserve any existing username
        if (!dbIdentity) {
            console.log(`⚠️ Token #${tokenId} not in database, checking for existing entry by address...`);

            // Check if there's an identity with this address but wrong tokenId
            const existingByAddress = await Identity.findOne({
                ownerAddress: address.toLowerCase()
            });

            if (existingByAddress) {
                console.log(`🔧 Updating existing identity ${existingByAddress.tokenId} → ${tokenId}`);

                // Update the existing identity with correct tokenId
                existingByAddress.tokenId = Number(tokenId);
                existingByAddress.primarySkill = blockchainData.primarySkill || existingByAddress.primarySkill;
                existingByAddress.reputationScore = Number(blockchainData.reputationScore || existingByAddress.reputationScore);
                existingByAddress.skillLevel = Number(blockchainData.skillLevel || existingByAddress.skillLevel);
                existingByAddress.achievementCount = Number(blockchainData.achievementCount || existingByAddress.achievementCount);
                existingByAddress.isVerified = true;
                existingByAddress.lastUpdate = Date.now();
                existingByAddress.updatedAt = new Date();

                await existingByAddress.save();
                dbIdentity = existingByAddress;

                console.log(`✅ Updated identity: ${dbIdentity.username} (Token #${tokenId})`);
            } else {
                console.log(`📝 Creating new database entry for Token #${tokenId}...`);

                // Create new database entry
                dbIdentity = new Identity({
                    tokenId: Number(tokenId),
                    username: `User #${tokenId}`, // Temporary, will be updated when user sets it
                    ownerAddress: address.toLowerCase(),
                    primarySkill: blockchainData.primarySkill || 'Unknown',
                    reputationScore: Number(blockchainData.reputationScore || 100),
                    skillLevel: Number(blockchainData.skillLevel || 1),
                    achievementCount: Number(blockchainData.achievementCount || 0),
                    isVerified: true,
                    nftBasePrice: Number(blockchainData.basePrice || parseEther('0.001')),
                    currentPrice: Number(blockchainData.currentPrice || parseEther('0.001')),
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
                    lastUpdate: Date.now()
                });

                await dbIdentity.save();
                console.log(`✅ Created new identity: Token #${tokenId}`);
            }
        }

        // Step 6: Return the identity with REAL username from database
        const userIdentity = {
            tokenId: dbIdentity.tokenId,
            username: dbIdentity.username, // ⭐ REAL USERNAME FROM DATABASE
            primarySkill: dbIdentity.primarySkill,
            ownerAddress: dbIdentity.ownerAddress,
            reputationScore: dbIdentity.reputationScore,
            skillLevel: dbIdentity.skillLevel,
            achievementCount: dbIdentity.achievementCount,
            isVerified: true, // Verified since it's on blockchain
            currentPrice: dbIdentity.currentPrice,
            basePrice: dbIdentity.nftBasePrice,
            profile: dbIdentity.profile,
            source: 'user-identity-with-real-username'
        };

        console.log(`✅ Returning identity with REAL username: ${userIdentity.username} (Token #${userIdentity.tokenId})`);

        res.json({
            success: true,
            identity: userIdentity
        });

    } catch (error: any) {
        console.error('❌ Identity lookup error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get identity'
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
                contractAddress: CONTRACT_ADDRESS,
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

// Universal username update - FIXED to preserve usernames
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

        // Check if username is already taken by someone else
        const existingUser = await Identity.findOne({
            username,
            ownerAddress: { $ne: ownerAddress.toLowerCase() }
        });

        if (existingUser) {
            res.status(400).json({
                success: false,
                error: 'Username is already taken'
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
            console.log(`✅ Username updated: ${ownerAddress} → ${username}`);
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