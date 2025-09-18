import express, { Request, Response } from 'express';
import Identity from '../models/Identity';
import AchievementHistory from '../models/AchievementHistory';
import PriceHistory from '../models/PriceHistory';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// ==================== ENHANCED: Price Impact Calculation System ====================

const calculatePriceImpact = (achievementData: any, currentPrice: number): number => {
    const basePoints = achievementData.points || 10;
    const category = achievementData.category || 'milestone';

    // Category multipliers
    const categoryMultipliers: { [key: string]: number } = {
        'hackathon': 2.5,      // Highest impact
        'certification': 2.0,
        'verification': 1.8,
        'milestone': 1.5,
        'reputation': 1.2,
        'profile': 1.0,
        'activity': 0.8,
        'social': 0.5          // Lowest impact
    };

    const multiplier = categoryMultipliers[category] || 1.0;

    // Base impact: 0.1% to 2.5% based on points and category
    const baseImpact = (basePoints / 100) * multiplier;

    // Price scaling: Higher value NFTs get smaller percentage increases
    const priceScaling = Math.max(0.1, 50 / currentPrice);

    // Final price increase (in ETH)
    const priceIncrease = currentPrice * baseImpact * priceScaling;

    return Math.min(priceIncrease, currentPrice * 0.25); // Cap at 25% increase
};

const calculateGoalReward = (goalData: any, currentPrice: number): number => {
    const difficulty = goalData.difficulty || 'medium';
    const timeToComplete = goalData.timeToComplete || 30; // days

    const difficultyMultipliers: { [key: string]: number } = {
        'easy': 1.0,
        'medium': 1.5,
        'hard': 2.5,
        'expert': 4.0
    };

    const timeBonus = Math.max(0.5, (60 - timeToComplete) / 60); // Bonus for faster completion
    const multiplier = difficultyMultipliers[difficulty] * timeBonus;

    return currentPrice * 0.02 * multiplier; // 2-8% increase based on difficulty and speed
};

// ==================== ENHANCED ACHIEVEMENT ROUTES ====================

// Add achievement with automatic price impact calculation
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

        // Calculate price impact
        const priceImpact = calculatePriceImpact(achievement, identity.currentPrice);
        const oldPrice = identity.currentPrice;
        const newPrice = oldPrice + priceImpact;
        const priceChangePercent = ((newPrice - oldPrice) / oldPrice) * 100;

        // Create achievement record
        const newAchievement = {
            ...achievement,
            id: achievement.id || `ach_${Date.now()}`,
            dateAchieved: new Date(achievement.dateAchieved || Date.now()),
            verified: achievement.verified || false,
            points: achievement.points || 10,
            valueImpact: priceImpact,
            category: achievement.category || 'milestone'
        };

        // Save to achievement history
        const achievementHistory = new AchievementHistory({
            token_id: tokenId,
            title: newAchievement.title,
            description: newAchievement.description,
            points: newAchievement.points,
            price_impact: Math.round(priceImpact * 10000), // Convert to basis points
            category: newAchievement.category,
            verified: newAchievement.verified,
            timestamp: newAchievement.dateAchieved
        });
        await achievementHistory.save();

        // Save to price history
        if (priceImpact > 0) {
            const priceHistoryEntry = new PriceHistory({
                token_id: tokenId,
                old_price: oldPrice,
                new_price: newPrice,
                price_change_percent: priceChangePercent,
                change_reason: `Achievement unlocked: ${newAchievement.title}`,
                triggered_by: 'achievement',
                details: {
                    achievement_id: newAchievement.id
                },
                timestamp: new Date()
            });
            await priceHistoryEntry.save();
        }

        // Update identity
        identity.profile.achievements.push(newAchievement);
        identity.achievementCount = identity.profile.achievements.length;
        identity.reputationScore += newAchievement.points;
        identity.currentPrice = newPrice;
        identity.lastUpdate = Date.now();

        await identity.save();

        // Emit real-time update if socket available
        if ((req as any).io) {
            (req as any).io.emit('achievement_unlocked', {
                tokenId,
                achievement: newAchievement,
                username: identity.username,
                priceImpact,
                newPrice,
                priceChangePercent
            });

            // Emit price update event
            (req as any).io.emit('price_updated', {
                tokenId,
                oldPrice,
                newPrice,
                changePercent: priceChangePercent,
                reason: `Achievement: ${newAchievement.title}`
            });
        }

        console.log(`🏆 Achievement added: ${newAchievement.title} (+${newAchievement.points} rep, +${priceImpact.toFixed(4)} ETH)`);

        res.json({
            success: true,
            achievement: newAchievement,
            priceImpact: {
                oldPrice,
                newPrice,
                increase: priceImpact,
                changePercent: priceChangePercent
            },
            newReputationScore: identity.reputationScore,
            message: `Achievement unlocked! NFT price increased by ${priceChangePercent.toFixed(2)}%`
        });

    } catch (error) {
        console.error('Error adding achievement:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add achievement'
        });
    }
});

// Add bulk achievements (for goal completion rewards)
router.post('/add-bulk', async (req: Request, res: Response): Promise<void> => {
    try {
        const { tokenId, achievements } = req.body;

        if (!tokenId || !Array.isArray(achievements)) {
            res.status(400).json({
                success: false,
                error: 'Token ID and achievements array are required'
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

        let totalPriceImpact = 0;
        let totalPoints = 0;
        const processedAchievements = [];
        const oldPrice = identity.currentPrice;

        // Process each achievement
        for (const achievement of achievements) {
            const priceImpact = calculatePriceImpact(achievement, identity.currentPrice + totalPriceImpact);

            const newAchievement = {
                ...achievement,
                id: achievement.id || `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                dateAchieved: new Date(),
                verified: true, // Bulk achievements are auto-verified
                points: achievement.points || 10,
                valueImpact: priceImpact,
                category: achievement.category || 'milestone'
            };

            // Save to achievement history
            await new AchievementHistory({
                token_id: tokenId,
                title: newAchievement.title,
                description: newAchievement.description,
                points: newAchievement.points,
                price_impact: Math.round(priceImpact * 10000),
                category: newAchievement.category,
                verified: true,
                timestamp: new Date()
            }).save();

            identity.profile.achievements.push(newAchievement);
            processedAchievements.push(newAchievement);

            totalPriceImpact += priceImpact;
            totalPoints += newAchievement.points;
        }

        const newPrice = oldPrice + totalPriceImpact;
        const priceChangePercent = ((newPrice - oldPrice) / oldPrice) * 100;

        // Save to price history
        if (totalPriceImpact > 0) {
            await new PriceHistory({
                token_id: tokenId,
                old_price: oldPrice,
                new_price: newPrice,
                price_change_percent: priceChangePercent,
                change_reason: `Bulk achievements: ${achievements.length} unlocked`,
                triggered_by: 'achievement',
                timestamp: new Date()
            }).save();
        }

        // Update identity
        identity.achievementCount = identity.profile.achievements.length;
        identity.reputationScore += totalPoints;
        identity.currentPrice = newPrice;
        identity.lastUpdate = Date.now();

        await identity.save();

        res.json({
            success: true,
            achievements: processedAchievements,
            summary: {
                count: achievements.length,
                totalPoints,
                totalPriceImpact,
                oldPrice,
                newPrice,
                priceChangePercent
            },
            message: `${achievements.length} achievements unlocked! NFT value increased by ${priceChangePercent.toFixed(2)}%`
        });

    } catch (error) {
        console.error('Error adding bulk achievements:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add bulk achievements'
        });
    }
});

// ==================== GOAL COMPLETION REWARD SYSTEM ====================

// Complete goal and reward achievement
router.post('/complete-goal', async (req: Request, res: Response): Promise<void> => {
    try {
        const { tokenId, goalId, goalData, proof } = req.body;

        const identity = await Identity.findOne({ tokenId });
        if (!identity) {
            res.status(404).json({
                success: false,
                error: 'Identity not found'
            });
            return;
        }

        // Calculate goal completion reward
        const rewardImpact = calculateGoalReward(goalData, identity.currentPrice);
        const oldPrice = identity.currentPrice;
        const newPrice = oldPrice + rewardImpact;
        const priceChangePercent = ((newPrice - oldPrice) / oldPrice) * 100;

        // Create achievement for goal completion
        const completionAchievement = {
            id: `goal_${goalId}_${Date.now()}`,
            title: `Goal Completed: ${goalData.title}`,
            description: goalData.description || `Successfully completed goal: ${goalData.title}`,
            category: 'milestone' as const,
            points: goalData.rewardPoints || 25,
            valueImpact: rewardImpact,
            dateAchieved: new Date(),
            verified: true,
            proof: proof ? { type: 'document' as const, value: proof } : undefined
        };

        // Save achievement history
        await new AchievementHistory({
            token_id: tokenId,
            title: completionAchievement.title,
            description: completionAchievement.description,
            points: completionAchievement.points,
            price_impact: Math.round(rewardImpact * 10000),
            category: 'milestone',
            verified: true,
            proof: completionAchievement.proof,
            timestamp: new Date()
        }).save();

        // Save price history
        await new PriceHistory({
            token_id: tokenId,
            old_price: oldPrice,
            new_price: newPrice,
            price_change_percent: priceChangePercent,
            change_reason: `Goal completed: ${goalData.title}`,
            triggered_by: 'goal_completion',
            details: {
                goal_id: goalId
            },
            timestamp: new Date()
        }).save();

        // Update identity
        identity.profile.achievements.push(completionAchievement);
        identity.achievementCount = identity.profile.achievements.length;
        identity.reputationScore += completionAchievement.points;
        identity.currentPrice = newPrice;
        identity.lastUpdate = Date.now();

        await identity.save();

        // Emit real-time updates
        if ((req as any).io) {
            (req as any).io.emit('goal_completed', {
                tokenId,
                goalId,
                achievement: completionAchievement,
                priceImpact: rewardImpact,
                newPrice,
                priceChangePercent
            });
        }

        res.json({
            success: true,
            achievement: completionAchievement,
            goalReward: {
                oldPrice,
                newPrice,
                rewardImpact,
                changePercent: priceChangePercent
            },
            message: `Goal completed! Earned ${completionAchievement.points} reputation points and ${priceChangePercent.toFixed(2)}% price increase`
        });

    } catch (error) {
        console.error('Error completing goal:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to complete goal'
        });
    }
});

// ==================== EXISTING ROUTES (Enhanced) ====================

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

        // Get achievement history for analytics
        const achievementHistory = await AchievementHistory.find({ token_id: tokenId })
            .sort({ timestamp: -1 })
            .lean();

        // Calculate achievement analytics
        const totalPriceImpact = achievementHistory.reduce((sum, a: any) => sum + (a.price_impact / 10000), 0);
        const categoryStats = achievementHistory.reduce((stats: any, a: any) => {
            stats[a.category] = (stats[a.category] || 0) + 1;
            return stats;
        }, {} as { [key: string]: number });

        res.json({
            success: true,
            achievements: identity.profile?.achievements || [],
            achievementHistory,
            totalCount: identity.achievementCount,
            analytics: {
                totalPriceImpact,
                categoryStats,
                verifiedCount: achievementHistory.filter((a: any) => a.verified).length,
                averagePoints: achievementHistory.length > 0
                    ? achievementHistory.reduce((sum: number, a: any) => sum + a.points, 0) / achievementHistory.length
                    : 0
            }
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
        const category = req.query.category as string;
        const skip = (page - 1) * limit;

        const filter = category ? { category } : {};

        const achievements = await AchievementHistory.find(filter)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await AchievementHistory.countDocuments(filter);

        // Get identity data for each achievement
        const tokenIds = [...new Set(achievements.map(a => a.token_id))];
        const identities = await Identity.find({ tokenId: { $in: tokenIds } })
            .select('tokenId username')
            .lean();

        const identityMap = identities.reduce((map, id) => {
            map[id.tokenId] = id;
            return map;
        }, {} as { [key: number]: any });

        const enrichedAchievements = achievements.map(achievement => ({
            ...achievement,
            identity: identityMap[achievement.token_id]
        }));

        res.json({
            success: true,
            achievements: enrichedAchievements,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                hasNext: page * limit < total,
                hasPrev: page > 1
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

// Get available achievement templates with price impact preview
router.get('/available', async (req: Request, res: Response): Promise<void> => {
    try {
        const mockPrice = 50; // For price impact calculation

        const availableAchievements = [
            {
                id: 'first_identity',
                title: 'Digital Pioneer',
                description: 'Created your first SomniaID identity',
                points: 50,
                category: 'milestone',
                estimatedPriceImpact: calculatePriceImpact({ points: 50, category: 'milestone' }, mockPrice)
            },
            {
                id: 'reputation_100',
                title: 'Rising Star',
                description: 'Reached 100 reputation points',
                points: 25,
                category: 'reputation',
                estimatedPriceImpact: calculatePriceImpact({ points: 25, category: 'reputation' }, mockPrice)
            },
            {
                id: 'hackathon_win',
                title: 'Hackathon Champion',
                description: 'Won a hackathon competition',
                points: 100,
                category: 'hackathon',
                estimatedPriceImpact: calculatePriceImpact({ points: 100, category: 'hackathon' }, mockPrice)
            },
            {
                id: 'certification_earned',
                title: 'Certified Professional',
                description: 'Earned a professional certification',
                points: 75,
                category: 'certification',
                estimatedPriceImpact: calculatePriceImpact({ points: 75, category: 'certification' }, mockPrice)
            },
            {
                id: 'first_verification',
                title: 'Verified Member',
                description: 'Got your identity verified',
                points: 75,
                category: 'verification',
                estimatedPriceImpact: calculatePriceImpact({ points: 75, category: 'verification' }, mockPrice)
            }
        ];

        res.json({
            success: true,
            achievements: availableAchievements,
            priceImpactNote: 'Price impact varies based on current NFT value. Higher value NFTs get smaller percentage increases.'
        });
    } catch (error) {
        console.error('Get available achievements error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get available achievements'
        });
    }
});

// Get achievement statistics with price impact analysis
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
    try {
        const totalAchievements = await AchievementHistory.countDocuments();
        const verifiedAchievements = await AchievementHistory.countDocuments({ verified: true });

        const categoryStats = await AchievementHistory.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 }, totalPriceImpact: { $sum: '$price_impact' } } },
            { $sort: { count: -1 } }
        ]);

        const priceImpactStats = await AchievementHistory.aggregate([
            {
                $group: {
                    _id: null,
                    totalPriceImpact: { $sum: '$price_impact' },
                    averagePriceImpact: { $avg: '$price_impact' },
                    maxPriceImpact: { $max: '$price_impact' }
                }
            }
        ]);

        const topAchievers = await Identity.find()
            .sort({ achievementCount: -1 })
            .limit(5)
            .select('tokenId username achievementCount reputationScore currentPrice')
            .lean();

        res.json({
            success: true,
            stats: {
                totalAchievements,
                verifiedAchievements,
                verificationRate: totalAchievements > 0 ? (verifiedAchievements / totalAchievements) * 100 : 0,
                categoryBreakdown: categoryStats,
                priceImpact: {
                    totalBasisPoints: priceImpactStats[0]?.totalPriceImpact || 0,
                    totalETH: (priceImpactStats[0]?.totalPriceImpact || 0) / 10000,
                    averageBasisPoints: priceImpactStats[0]?.averagePriceImpact || 0,
                    maxBasisPoints: priceImpactStats[0]?.maxPriceImpact || 0
                },
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

// ==================== KEEP EXISTING ROUTES ====================

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

        const achievement = identity.profile?.achievements?.find((a: any) => a.id === achievementId);
        if (!achievement) {
            res.status(404).json({
                success: false,
                error: 'Achievement not found'
            });
            return;
        }

        if (proof && proof.length > 0) {
            achievement.verified = true;
            achievement.proof = { type: 'url', value: proof };

            // Update achievement history
            await AchievementHistory.updateOne(
                { token_id: tokenId, title: achievement.title },
                { $set: { verified: true, proof: { type: 'url', value: proof } } }
            );

            // Bonus for verification
            identity.reputationScore += 5;
            identity.currentPrice += 2;
            identity.lastUpdate = Date.now();

            await identity.save();

            res.json({
                success: true,
                message: 'Achievement verified successfully',
                bonusReward: { reputation: 5, price: 2 }
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
            .select('tokenId username achievementCount reputationScore skillLevel isVerified currentPrice')
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

// Delete achievement
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
        identity.currentPrice -= removedAchievement.valueImpact || 0;
        identity.lastUpdate = Date.now();

        await identity.save();

        // Remove from achievement history
        await AchievementHistory.deleteOne({
            token_id: tokenId,
            title: removedAchievement.title
        });

        res.json({
            success: true,
            message: 'Achievement removed successfully',
            priceReduction: removedAchievement.valueImpact || 0
        });
    } catch (error) {
        console.error('Error deleting achievement:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete achievement'
        });
    }
});

export default router;