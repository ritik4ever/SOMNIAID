import express, { Request, Response } from 'express';
import Identity from '../models/Identity';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import BlockchainSyncService from '../services/blockchain-sync';

const router = express.Router();

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

                        // Fix the token ID
                        const fixed = await BlockchainSyncService.fixAddressTokenId(identity.ownerAddress);

                        if (fixed) {
                            // Update the returned data with correct token ID
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

// Get identity with blockchain-first approach
router.get('/blockchain/:address', async (req: Request, res: Response): Promise<void> => {
    try {
        const { address } = req.params;

        console.log(`🔍 Universal blockchain lookup for address: ${address}`);

        // Step 1: Get identity from blockchain (works for any token ID)
        const blockchainIdentity = await BlockchainSyncService.getBlockchainIdentity(address);

        if (!blockchainIdentity) {
            res.json({
                success: false,
                error: 'No identity found on blockchain for this address'
            });
            return;
        }

        // Step 2: Check if database entry exists
        let dbIdentity = await Identity.findOne({ ownerAddress: address.toLowerCase() });

        // Step 3: AUTO-CREATE missing database entry for ANY token
        if (!dbIdentity) {
            console.log(`📝 Auto-creating database entry for Token #${blockchainIdentity.tokenId}`);

            try {
                dbIdentity = new Identity({
                    tokenId: blockchainIdentity.tokenId, // Uses actual token ID from blockchain
                    username: `User${blockchainIdentity.tokenId}`, // Dynamic username
                    primarySkill: blockchainIdentity.primarySkill,
                    ownerAddress: blockchainIdentity.ownerAddress,
                    experience: 'beginner',
                    reputationScore: blockchainIdentity.reputationScore,
                    skillLevel: blockchainIdentity.skillLevel,
                    achievementCount: blockchainIdentity.achievementCount,
                    isVerified: true, // Auto-verify if exists on blockchain
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
                // Continue with blockchain-only data if database creation fails
            }
        }

        // Step 4: Return merged data (works for any token)
        const mergedIdentity = {
            // Blockchain data (source of truth)
            tokenId: blockchainIdentity.tokenId,
            ownerAddress: blockchainIdentity.ownerAddress,
            reputationScore: blockchainIdentity.reputationScore,
            skillLevel: blockchainIdentity.skillLevel,
            achievementCount: blockchainIdentity.achievementCount,
            lastUpdate: blockchainIdentity.lastUpdate,
            primarySkill: blockchainIdentity.primarySkill,
            isVerified: true, // Auto-verify if exists on blockchain

            // Database data (or defaults)
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

            // Metadata
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

                        // Fix the token ID
                        const fixed = await BlockchainSyncService.fixAddressTokenId(identity.ownerAddress);

                        if (fixed) {
                            // Update the returned data with correct token ID
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


// route to check if token is listed

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

        // Use your blockchain sync service to check listing
        const blockchainIdentity = await BlockchainSyncService.getBlockchainIdentity('0x0941c361bbe04e739fAB4Fbac2E4b3A72EdC810C'); // You'd need to get owner first

        // For now, let's create a simple response
        res.json({
            success: true,
            tokenId: tokenId,
            listed: false, // We'll update this after testing
            price: "0"
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/debug/:tokenId/:address', async (req: Request, res: Response): Promise<void> => {
    try {
        const tokenId = parseInt(req.params.tokenId);
        const address = req.params.address;

        // Get blockchain identity to verify contract connection
        const blockchainIdentity = await BlockchainSyncService.getBlockchainIdentity(address);

        if (!blockchainIdentity) {
            res.json({
                success: false,
                error: 'No identity found on blockchain'
            });
            return;
        }

        // Return debug information
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

// FIXED: Create identity with proper token ID generation
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

        // Check if username already exists
        const existingIdentity = await Identity.findOne({ username });
        if (existingIdentity) {
            res.status(400).json({
                success: false,
                error: 'Username already taken'
            });
            return;
        }

        let tokenId: number;

        // FIXED: Get token ID from blockchain if address provided
        if (ownerAddress && txHash) {
            console.log('🔍 Getting token ID from blockchain...');

            try {
                const blockchainIdentity = await BlockchainSyncService.getBlockchainIdentity(ownerAddress);

                if (blockchainIdentity) {
                    tokenId = blockchainIdentity.tokenId;
                    console.log(`✅ Using blockchain token ID: ${tokenId}`);
                } else {
                    // Fallback: generate temporary token ID, will be synced later
                    tokenId = Math.floor(Date.now() / 1000);
                    console.log(`⚠️  Blockchain identity not found, using temporary ID: ${tokenId}`);
                }
            } catch (error) {
                console.error('Error fetching blockchain token ID:', error);
                tokenId = Math.floor(Date.now() / 1000);
            }
        } else {
            // No blockchain data, generate temporary ID
            tokenId = Math.floor(Date.now() / 1000);
            console.log(`📝 Using temporary token ID: ${tokenId}`);
        }

        // Parse profile data
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

        // Create identity
        const identityData = {
            tokenId,
            username,
            primarySkill,
            ownerAddress: ownerAddress || `0x${Math.random().toString(16).substr(2, 40)}`,
            experience: profileData.experience || 'beginner',
            reputationScore: profileData.reputationScore || 100,
            skillLevel: profileData.skillLevel || 1,
            achievementCount: profileData.profile?.achievements?.length || 0,
            isVerified: !!txHash, // Auto-verify if transaction hash provided
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

        // If we have an owner address, schedule a sync check
        if (ownerAddress && txHash) {
            // Schedule sync verification in 10 seconds
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

// NEW: Manual sync endpoint
router.post('/sync-blockchain', async (req: Request, res: Response): Promise<void> => {
    try {
        const { address } = req.body;

        if (address) {
            // Sync specific address
            const fixed = await BlockchainSyncService.fixAddressTokenId(address);

            res.json({
                success: true,
                message: fixed ? `Token ID synced for ${address}` : `No sync needed for ${address}`,
                fixed
            });
        } else {
            // Sync all identities
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

// Universal username update (no authentication required for now)

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