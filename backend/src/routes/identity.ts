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

// Create identity - NO AUTH REQUIRED FOR NOW
router.post('/create', async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('Create identity request received:', req.body);

        const { username, primarySkill, bio } = req.body;

        if (!username || !primarySkill) {
            res.status(400).json({
                success: false,
                error: 'Username and primary skill are required'
            });
            return;
        }

        // Parse profile data if bio contains JSON
        let profileData: any = {};
        try {
            if (bio && typeof bio === 'string' && bio.startsWith('{')) {
                profileData = JSON.parse(bio);
            } else {
                profileData = { profile: { bio: bio || '' } };
            }
        } catch (parseError) {
            console.log('Bio is not JSON, treating as string:', bio);
            profileData = { profile: { bio: bio || '' } };
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

        // Generate tokenId
        const tokenId = Math.floor(Date.now() / 1000);

        // Create identity with comprehensive data
        const identityData = {
            tokenId,
            username,
            primarySkill,
            ownerAddress: profileData.ownerAddress || 'demo-address-' + Date.now(),
            experience: profileData.experience || 'beginner',
            reputationScore: profileData.reputationScore || 100,
            skillLevel: profileData.skillLevel || 1,
            achievementCount: profileData.achievementCount || 0,
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
                socialLinks: profileData.profile?.socialLinks || {},
                education: profileData.profile?.education || [],
                workExperience: profileData.profile?.workExperience || []
            },
            profileViews: 0,
            followers: [],
            following: [],
            lastUpdate: Date.now()
        };

        console.log('Creating identity with data:', identityData);

        const identity = new Identity(identityData);
        await identity.save();

        console.log('Identity created successfully:', identity._id);

        res.json({
            success: true,
            identity: identity.toObject()
        });
    } catch (error: any) {
        console.error('Error creating identity:', error);
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

        const identity = await Identity.findOneAndUpdate(
            { tokenId },
            { ...updates, lastUpdate: Date.now() },
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
            identity
        });
    } catch (error) {
        console.error('Error updating identity:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update identity'
        });
    }
});

export default router;