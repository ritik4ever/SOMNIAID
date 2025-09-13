import express from 'express';
import { authenticateToken } from '../middleware/auth';
import User from '../models/User';
import { blockchainService } from '../utils/blockchain';

const router = express.Router();

// Get achievements for a token ID
router.get('/:tokenId', async (req, res): Promise<void> => {
    try {
        const { tokenId } = req.params;

        const tokenIdNum = parseInt(tokenId);
        if (isNaN(tokenIdNum) || tokenIdNum < 0) {
            res.status(400).json({ error: 'Invalid token ID' });
            return;
        }

        try {
            const achievements = await blockchainService.getAchievements(tokenIdNum);
            res.json({
                success: true,
                achievements
            });
            return;
        } catch (blockchainError) {
            // Fallback to database
            const user = await User.findOne({ tokenId: tokenIdNum });
            if (user) {
                res.json({
                    success: true,
                    achievements: user.profile.achievements || []
                });
                return;
            } else {
                res.status(404).json({ error: 'Achievements not found' });
                return;
            }
        }

    } catch (error) {
        console.error('Get achievements error:', error);
        res.status(500).json({ error: 'Failed to get achievements' });
    }
});

// Add achievement to identity
router.post('/:tokenId/add', authenticateToken, async (req: any, res): Promise<void> => {
    try {
        const { tokenId } = req.params;
        const { title, description, points } = req.body;

        if (!title || !description || !points) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        if (points <= 0) {
            res.status(400).json({ error: 'Points must be greater than 0' });
            return;
        }

        const tokenIdNum = parseInt(tokenId);
        if (isNaN(tokenIdNum)) {
            res.status(400).json({ error: 'Invalid token ID' });
            return;
        }

        // Find user by tokenId
        const user = await User.findOne({ tokenId: tokenIdNum });
        if (!user) {
            res.status(404).json({ error: 'Identity not found' });
            return;
        }

        // Check if user is authorized (owns the token or is admin)
        if (user.address !== req.user.address && req.user.userId !== process.env.ADMIN_USER_ID) {
            res.status(403).json({ error: 'Not authorized to add achievements' });
            return;
        }

        // FIXED: Use Date object instead of timestamp number
        const newAchievement = {
            title,
            description,
            points: parseInt(points),
            timestamp: new Date(), // FIXED: Use Date object instead of Date.now()
            id: Date.now().toString()
        };

        // Add to user profile
        if (!user.profile.achievements) {
            user.profile.achievements = [];
        }

        user.profile.achievements.push(newAchievement);

        // Update reputation score
        user.reputation.score += parseInt(points);

        await user.save();

        res.json({
            success: true,
            achievement: newAchievement,
            newReputationScore: user.reputation.score
        });

    } catch (error) {
        console.error('Add achievement error:', error);
        res.status(500).json({ error: 'Failed to add achievement' });
    }
});

// Get available achievement templates
router.get('/available', async (req, res): Promise<void> => {
    try {
        const availableAchievements = [
            {
                id: 'first_identity',
                title: 'Digital Pioneer',
                description: 'Created your first SomniaID identity',
                points: 50,
                category: 'milestone'
            },
            {
                id: 'reputation_100',
                title: 'Rising Star',
                description: 'Reached 100 reputation points',
                points: 25,
                category: 'reputation'
            },
            {
                id: 'reputation_500',
                title: 'Community Leader',
                description: 'Reached 500 reputation points',
                points: 100,
                category: 'reputation'
            },
            {
                id: 'first_verification',
                title: 'Verified Member',
                description: 'Got your identity verified',
                points: 75,
                category: 'verification'
            },
            {
                id: 'active_week',
                title: 'Weekly Warrior',
                description: 'Active for 7 consecutive days',
                points: 30,
                category: 'activity'
            },
            {
                id: 'social_connector',
                title: 'Social Connector',
                description: 'Connected all social media accounts',
                points: 40,
                category: 'profile'
            }
        ];

        res.json({
            success: true,
            achievements: availableAchievements
        });

    } catch (error) {
        console.error('Get available achievements error:', error);
        res.status(500).json({ error: 'Failed to get available achievements' });
    }
});

// Get leaderboard based on achievements
router.get('/leaderboard', async (req, res): Promise<void> => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
        const skip = (page - 1) * limit;

        const users = await User.find({
            $or: [
                { 'profile.achievements.0': { $exists: true } },
                { 'reputation.score': { $gt: 0 } }
            ]
        })
            .sort({ 'reputation.score': -1 })
            .skip(skip)
            .limit(limit)
            .select('username tokenId profile.achievements reputation');

        const leaderboard = users.map((user, index) => ({
            rank: skip + index + 1,
            tokenId: user.tokenId,
            username: user.username || `Identity #${user.tokenId}`,
            reputationScore: user.reputation.score,
            achievementCount: user.profile.achievements?.length || 0,
            achievements: user.profile.achievements || []
        }));

        res.json({
            success: true,
            leaderboard,
            pagination: {
                page,
                limit,
                hasMore: users.length === limit
            }
        });

    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ error: 'Failed to get leaderboard' });
    }
});

export default router;