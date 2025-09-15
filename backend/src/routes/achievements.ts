import express, { Request, Response } from 'express';
import Identity from '../models/Identity';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// Add achievement to user's profile
router.post('/add', async (req: Request, res: Response): Promise<void> => {
    try {
        const { tokenId, achievement } = req.body;

        if (!tokenId || !achievement) {
            res.status(400).json({
                success: false,
                error: 'Token ID and achievement data are required'
            });
            return;
        }

        // Find the identity
        const identity = await Identity.findOne({ tokenId });
        if (!identity) {
            res.status(404).json({
                success: false,
                error: 'Identity not found'
            });
            return;
        }

        // Add achievement to profile
        const newAchievement = {
            ...achievement,
            id: `manual_${Date.now()}`,
            dateAchieved: new Date(achievement.dateAchieved || Date.now()),
            verified: false,
            points: achievement.points || 10,
            valueImpact: achievement.valueImpact || Math.floor((achievement.points || 10) / 2)
        };

        identity.profile.achievements.push(newAchievement);
        identity.achievementCount = identity.profile.achievements.length;
        identity.reputationScore += newAchievement.points;
        identity.currentPrice += newAchievement.valueImpact;
        identity.lastUpdate = Date.now();

        await identity.save();

        // Emit real-time update if socket available
        if ((req as any).io) {
            (req as any).io.emit('achievement_unlocked', {
                tokenId,
                achievement: newAchievement,
                username: identity.username
            });
        }

        res.json({
            success: true,
            achievement: newAchievement,
            newReputationScore: identity.reputationScore,
            newPrice: identity.currentPrice
        });
    } catch (error) {
        console.error('Error adding achievement:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add achievement'
        });
    }
});

// Get achievements for a user
router.get('/user/:tokenId', async (req: Request, res: Response): Promise<void> => {
    try {
        const tokenId = parseInt(req.params.tokenId);

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
            achievements: identity.profile?.achievements || [],
            totalCount: identity.achievementCount
        });
    } catch (error) {
        console.error('Error fetching achievements:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch achievements'
        });
    }
});

// Get all achievements across platform
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        // Get all achievements from all identities
        const identities = await Identity.aggregate([
            { $unwind: '$profile.achievements' },
            { $sort: { 'profile.achievements.dateAchieved': -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $project: {
                    tokenId: 1,
                    username: 1,
                    achievement: '$profile.achievements'
                }
            }
        ]);

        const total = await Identity.aggregate([
            { $unwind: '$profile.achievements' },
            { $count: 'total' }
        ]);

        res.json({
            success: true,
            achievements: identities,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil((total[0]?.total || 0) / limit),
                totalItems: total[0]?.total || 0
            }
        });
    } catch (error) {
        console.error('Error fetching all achievements:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch achievements'
        });
    }
});

// Get available achievement templates
router.get('/available', async (req: Request, res: Response): Promise<void> => {
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
        res.status(500).json({
            success: false,
            error: 'Failed to get available achievements'
        });
    }
});

// Verify achievement
router.post('/verify', async (req: Request, res: Response): Promise<void> => {
    try {
        const { tokenId, achievementId, proof } = req.body;

        const identity = await Identity.findOne({ tokenId });
        if (!identity) {
            res.status(404).json({
                success: false,
                error: 'Identity not found'
            });
            return;
        }

        // Find the achievement
        const achievement = identity.profile?.achievements?.find((a: any) => a.id === achievementId);
        if (!achievement) {
            res.status(404).json({
                success: false,
                error: 'Achievement not found'
            });
            return;
        }

        // Simple verification (in production, this would be more sophisticated)
        if (proof && proof.length > 0) {
            achievement.verified = true;
            achievement.proof = { type: 'url', value: proof };

            // Bonus points for verified achievement
            identity.reputationScore += 5;
            identity.currentPrice += 2;
            identity.lastUpdate = Date.now();

            await identity.save();

            res.json({
                success: true,
                message: 'Achievement verified successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                error: 'Proof required for verification'
            });
        }
    } catch (error) {
        console.error('Error verifying achievement:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify achievement'
        });
    }
});

// Get achievement leaderboard
router.get('/leaderboard', async (req: Request, res: Response): Promise<void> => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;

        const leaderboard = await Identity.find()
            .sort({ achievementCount: -1, reputationScore: -1 })
            .limit(limit)
            .select('tokenId username achievementCount reputationScore skillLevel isVerified')
            .lean();

        res.json({
            success: true,
            leaderboard
        });
    } catch (error) {
        console.error('Error fetching achievement leaderboard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch leaderboard'
        });
    }
});

// Delete achievement (for user's own achievements only)
router.delete('/:tokenId/:achievementId', async (req: Request, res: Response): Promise<void> => {
    try {
        const tokenId = parseInt(req.params.tokenId);
        const achievementId = req.params.achievementId;

        const identity = await Identity.findOne({ tokenId });
        if (!identity) {
            res.status(404).json({
                success: false,
                error: 'Identity not found'
            });
            return;
        }

        // Find and remove the achievement
        const achievementIndex = identity.profile?.achievements?.findIndex((a: any) => a.id === achievementId);
        if (achievementIndex === -1 || achievementIndex === undefined) {
            res.status(404).json({
                success: false,
                error: 'Achievement not found'
            });
            return;
        }

        const removedAchievement = identity.profile.achievements[achievementIndex];
        identity.profile.achievements.splice(achievementIndex, 1);

        // Update counts and scores
        identity.achievementCount = identity.profile.achievements.length;
        identity.reputationScore -= removedAchievement.points;
        identity.currentPrice -= removedAchievement.valueImpact;
        identity.lastUpdate = Date.now();

        await identity.save();

        res.json({
            success: true,
            message: 'Achievement removed successfully'
        });
    } catch (error) {
        console.error('Error deleting achievement:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete achievement'
        });
    }
});

// Get achievement statistics
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
    try {
        const totalAchievements = await Identity.aggregate([
            { $unwind: '$profile.achievements' },
            { $group: { _id: null, total: { $sum: 1 } } }
        ]);

        const verifiedAchievements = await Identity.aggregate([
            { $unwind: '$profile.achievements' },
            { $match: { 'profile.achievements.verified': true } },
            { $group: { _id: null, total: { $sum: 1 } } }
        ]);

        const categoryStats = await Identity.aggregate([
            { $unwind: '$profile.achievements' },
            { $group: { _id: '$profile.achievements.category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        const topAchievers = await Identity.find()
            .sort({ achievementCount: -1 })
            .limit(5)
            .select('username achievementCount reputationScore')
            .lean();

        res.json({
            success: true,
            stats: {
                totalAchievements: totalAchievements[0]?.total || 0,
                verifiedAchievements: verifiedAchievements[0]?.total || 0,
                verificationRate: totalAchievements[0]?.total > 0
                    ? ((verifiedAchievements[0]?.total || 0) / totalAchievements[0].total) * 100
                    : 0,
                categoryBreakdown: categoryStats,
                topAchievers
            }
        });
    } catch (error) {
        console.error('Error fetching achievement stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch achievement statistics'
        });
    }
});

export default router;