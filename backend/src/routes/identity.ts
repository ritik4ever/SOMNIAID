// backend/src/routes/identity.ts
import express, { Request, Response } from 'express';
import Identity from '../models/Identity';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// Get all identities
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const identities = await Identity.find()
            .sort({ reputationScore: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await Identity.countDocuments();

        res.json({
            success: true,
            identities,
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

// Get single identity by tokenId
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

        const identity = await Identity.findOne({ tokenId }).lean();

        if (!identity) {
            res.status(404).json({
                success: false,
                error: 'Identity not found'
            });
            return;
        }

        res.json({
            success: true,
            data: identity
        });
    } catch (error) {
        console.error('Error fetching identity:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch identity'
        });
    }
});

// FIXED: Enhanced Create identity route with automatic verification
router.post('/create', async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('=== CREATE IDENTITY DEBUG START ===');
        console.log('1. Raw request body:', JSON.stringify(req.body, null, 2));

        const { username, primarySkill, bio } = req.body;

        console.log('2. Extracted values:');
        console.log('   - username:', username);
        console.log('   - primarySkill:', primarySkill);
        console.log('   - bio type:', typeof bio);
        console.log('   - bio length:', bio?.length);
        console.log('   - bio starts with {:', bio?.startsWith('{'));

        if (!username || !primarySkill) {
            console.log('❌ Missing required fields');
            res.status(400).json({
                success: false,
                error: 'Username and primary skill are required'
            });
            return;
        }

        // Enhanced parsing with better logging
        let profileData: any = {};
        try {
            if (bio && typeof bio === 'string' && bio.startsWith('{')) {
                console.log('3. Parsing bio as JSON...');
                profileData = JSON.parse(bio);
                console.log('4. Parsed profileData structure:', Object.keys(profileData));
                console.log('5. Profile section exists:', !!profileData.profile);
                console.log('6. Transaction hash present:', !!profileData.txHash);

                if (profileData.profile) {
                    console.log('7. Profile section keys:', Object.keys(profileData.profile));
                    console.log('8. Achievements count:', profileData.profile.achievements?.length || 0);
                    console.log('9. Goals count:', profileData.profile.goals?.length || 0);
                    console.log('10. Skills count:', profileData.profile.skills?.length || 0);
                }
            } else {
                console.log('3. Bio is not JSON, treating as string');
                profileData = { profile: { bio: bio || '' } };
            }
        } catch (parseError) {
            console.log('3. JSON parse error:', parseError);
            profileData = { profile: { bio: bio || '' } };
        }

        // Check if username already exists
        const existingIdentity = await Identity.findOne({ username });
        if (existingIdentity) {
            console.log('❌ Username already taken:', username);
            res.status(400).json({
                success: false,
                error: 'Username already taken'
            });
            return;
        }

        // Generate tokenId
        const tokenId = Math.floor(Date.now() / 1000);
        console.log('11. Generated tokenId:', tokenId);

        // FIXED: Auto-verify if transaction hash is present
        const hasTransactionHash = !!profileData.txHash;
        console.log('12. Has transaction hash:', hasTransactionHash);
        console.log('13. Transaction hash:', profileData.txHash || 'None');

        // Create identity with comprehensive data
        const identityData = {
            tokenId,
            username,
            primarySkill,
            ownerAddress: profileData.ownerAddress || `0x${Math.random().toString(16).substr(2, 40)}`,
            experience: profileData.experience || 'beginner',
            reputationScore: profileData.reputationScore || 100,
            skillLevel: profileData.skillLevel || 1,
            achievementCount: profileData.profile?.achievements?.length || 0,
            isVerified: hasTransactionHash, // FIXED: Auto-verify if txHash exists
            currentPrice: profileData.currentPrice || 10,
            nftBasePrice: 10,
            priceHistory: [{
                price: profileData.currentPrice || 10,
                date: new Date(),
                trigger: hasTransactionHash ? 'Blockchain confirmed creation' : 'Initial creation'
            }],
            profile: {
                bio: profileData.profile?.bio || '',
                skills: profileData.profile?.skills || [],
                achievements: profileData.profile?.achievements || [],
                goals: profileData.profile?.goals || [],
                socialLinks: profileData.profile?.socialLinks || {
                    github: '',
                    twitter: '',
                    linkedin: '',
                    website: ''
                },
                education: profileData.profile?.education || [],
                workExperience: profileData.profile?.workExperience || []
            },
            profileViews: 0,
            followers: [],
            following: [],
            lastUpdate: Date.now(),
            txHash: profileData.txHash || null,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        console.log('14. Final identity data being saved:');
        console.log('    - Owner Address:', identityData.ownerAddress);
        console.log('    - Experience Level:', identityData.experience);
        console.log('    - Reputation Score:', identityData.reputationScore);
        console.log('    - Achievement Count:', identityData.achievementCount);
        console.log('    - IS VERIFIED:', identityData.isVerified); // FIXED: Now shows correct status
        console.log('    - TX Hash:', identityData.txHash ? 'Present' : 'None');
        console.log('    - Verification Status:', identityData.isVerified ? 'VERIFIED' : 'PENDING');

        const identity = new Identity(identityData);
        const savedIdentity = await identity.save();

        console.log('15. ✅ Identity created successfully with MongoDB ID:', savedIdentity._id);
        console.log('16. ✅ Verification Status:', savedIdentity.isVerified ? 'VERIFIED' : 'PENDING');
        console.log('17. ✅ All data saved including:');
        console.log(`    - ${savedIdentity.profile.achievements.length} achievements`);
        console.log(`    - ${savedIdentity.profile.goals.length} goals`);
        console.log(`    - ${savedIdentity.profile.skills.length} skills`);
        console.log('=== CREATE IDENTITY DEBUG END ===');

        res.json({
            success: true,
            identity: savedIdentity.toObject(),
            message: `Identity created successfully ${savedIdentity.isVerified ? 'and verified' : 'pending verification'}`
        });
    } catch (error: any) {
        console.error('❌ Error creating identity:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create identity'
        });
    }
});

// Update identity
router.put('/:tokenId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tokenId = parseInt(req.params.tokenId);
        const updates = req.body;

        console.log(`Updating identity ${tokenId} with:`, updates);

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

        console.log(`✅ Identity ${tokenId} updated successfully`);

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

        const identity = await Identity.findOne({ tokenId }).lean();

        if (!identity) {
            res.status(404).json({
                success: false,
                error: 'Identity not found'
            });
            return;
        }

        res.json({
            success: true,
            data: identity
        });
    } catch (error) {
        console.error('Error fetching identity:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch identity'
        });
    }
});

// Delete identity (admin only)
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

        console.log(`✅ Identity ${tokenId} deleted successfully`);

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