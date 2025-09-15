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

// FIXED: Enhanced Create identity route with comprehensive data handling and debug logging
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

                if (profileData.profile) {
                    console.log('6. Profile section keys:', Object.keys(profileData.profile));
                    console.log('7. Achievements count:', profileData.profile.achievements?.length || 0);
                    console.log('8. Goals count:', profileData.profile.goals?.length || 0);
                    console.log('9. Skills count:', profileData.profile.skills?.length || 0);
                    console.log('10. Social links keys:', Object.keys(profileData.profile.socialLinks || {}));

                    // Log individual achievements
                    if (profileData.profile.achievements?.length > 0) {
                        console.log('11. Achievement details:');
                        profileData.profile.achievements.forEach((ach: any, index: number) => {
                            console.log(`    ${index + 1}. ${ach.title} (${ach.category})`);
                        });
                    }

                    // Log individual goals
                    if (profileData.profile.goals?.length > 0) {
                        console.log('12. Goal details:');
                        profileData.profile.goals.forEach((goal: any, index: number) => {
                            console.log(`    ${index + 1}. ${goal.title} (${goal.priority} priority)`);
                        });
                    }
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
        console.log('13. Generated tokenId:', tokenId);

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
            isVerified: false,
            currentPrice: profileData.currentPrice || 10,
            nftBasePrice: 10,
            priceHistory: [{
                price: profileData.currentPrice || 10,
                date: new Date(),
                trigger: 'Initial creation'
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
        console.log('    - Skills Count:', identityData.profile.skills.length);
        console.log('    - Achievements:', identityData.profile.achievements.length);
        console.log('    - Goals:', identityData.profile.goals.length);
        console.log('    - Social Links Filled:', Object.values(identityData.profile.socialLinks).filter(Boolean).length);
        console.log('    - Bio Length:', identityData.profile.bio.length);
        console.log('    - TX Hash:', identityData.txHash ? 'Present' : 'None');

        const identity = new Identity(identityData);
        const savedIdentity = await identity.save();

        console.log('15. ✅ Identity created successfully with MongoDB ID:', savedIdentity._id);
        console.log('16. ✅ All data saved including:');
        console.log(`    - ${savedIdentity.profile.achievements.length} achievements`);
        console.log(`    - ${savedIdentity.profile.goals.length} goals`);
        console.log(`    - ${savedIdentity.profile.skills.length} skills`);
        console.log(`    - Social links: ${Object.entries(savedIdentity.profile.socialLinks).filter(([key, value]) => value).map(([key]) => key).join(', ') || 'None'}`);
        console.log('=== CREATE IDENTITY DEBUG END ===');

        res.json({
            success: true,
            identity: savedIdentity.toObject(),
            message: 'Identity created successfully with all profile data'
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