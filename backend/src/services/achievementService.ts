import Identity from '../models/Identity';
import AchievementHistory from '../models/AchievementHistory';
import PriceHistory from '../models/PriceHistory';

interface Achievement {
    id: string;
    title: string;
    description: string;
    points: number;
    category: string;
    unlockCondition: (identity: any) => boolean;
    priceImpact?: number;
}

interface AchievementUnlock {
    tokenId: number;
    achievement: {
        id: string;
        title: string;
        description: string;
        points: number;
        category: string;
        priceImpact?: number;
    };
    timestamp: Date;
}

class AchievementService {
    private achievements: Achievement[] = [
        {
            id: 'first_identity',
            title: 'Digital Pioneer',
            description: 'Created your first SomniaID identity',
            points: 50,
            category: 'milestone',
            unlockCondition: (identity) => true, // Always unlocked on creation
            priceImpact: 5
        },
        {
            id: 'reputation_100',
            title: 'Rising Star',
            description: 'Reached 100 reputation points',
            points: 25,
            category: 'reputation',
            unlockCondition: (identity) => identity.reputationScore >= 100,
            priceImpact: 2
        },
        {
            id: 'reputation_500',
            title: 'Community Leader',
            description: 'Reached 500 reputation points',
            points: 100,
            category: 'reputation',
            unlockCondition: (identity) => identity.reputationScore >= 500,
            priceImpact: 10
        },
        {
            id: 'first_verification',
            title: 'Verified Member',
            description: 'Got your identity verified',
            points: 75,
            category: 'verification',
            unlockCondition: (identity) => identity.isVerified,
            priceImpact: 8
        },
        {
            id: 'achievement_hunter',
            title: 'Achievement Hunter',
            description: 'Unlocked 10 achievements',
            points: 50,
            category: 'milestone',
            unlockCondition: (identity) => identity.achievementCount >= 10,
            priceImpact: 6
        }
    ];

    private realtimeService: any; // Will be injected

    constructor(realtimeService?: any) {
        this.realtimeService = realtimeService;
    }

    // Check and unlock achievements for a user
    async checkAchievements(tokenId: number, trigger = 'manual'): Promise<void> {
        try {
            const identity = await Identity.findOne({ tokenId });
            if (!identity) {
                console.warn(`Identity ${tokenId} not found for achievement check`);
                return;
            }

            // Get already unlocked achievements
            const unlockedAchievements = identity.profile?.achievements?.map((a: any) => a.id) || [];

            // Check each achievement
            for (const achievement of this.achievements) {
                if (!unlockedAchievements.includes(achievement.id)) {
                    if (achievement.unlockCondition(identity)) {
                        await this.unlockAchievement(tokenId, achievement, trigger);
                    }
                }
            }
        } catch (error) {
            console.error('Error checking achievements:', error);
        }
    }

    // Unlock a specific achievement
    async unlockAchievement(tokenId: number, achievement: Achievement, trigger = 'system'): Promise<boolean> {
        try {
            const identity = await Identity.findOne({ tokenId });
            if (!identity) return false;

            // Create achievement record
            const achievementRecord = {
                id: achievement.id,
                title: achievement.title,
                description: achievement.description,
                points: achievement.points,
                category: achievement.category as any, // Type assertion for flexibility
                dateAchieved: new Date(),
                verified: trigger === 'system', // Auto-verify system achievements
                valueImpact: achievement.priceImpact || 0
            };

            // Add to identity profile
            if (!identity.profile.achievements) {
                identity.profile.achievements = [];
            }
            identity.profile.achievements.push(achievementRecord);

            // Update stats
            identity.achievementCount = identity.profile.achievements.length;
            identity.reputationScore += achievement.points;
            identity.currentPrice += achievement.priceImpact || 0;
            identity.lastUpdate = Date.now();

            await identity.save();

            // Save to achievement history
            const historyRecord = new AchievementHistory({
                token_id: tokenId,
                title: achievement.title,
                description: achievement.description,
                points: achievement.points,
                price_impact: Math.round((achievement.priceImpact || 0) * 10000), // Convert to basis points
                category: achievement.category,
                verified: trigger === 'system',
                timestamp: new Date()
            });
            await historyRecord.save();

            // Record price change if applicable
            if (achievement.priceImpact && achievement.priceImpact > 0) {
                const oldPrice = identity.currentPrice - achievement.priceImpact;
                const priceChange = new PriceHistory({
                    token_id: tokenId,
                    old_price: oldPrice,
                    new_price: identity.currentPrice,
                    price_change_percent: ((achievement.priceImpact / oldPrice) * 100),
                    change_reason: `Achievement unlocked: ${achievement.title}`,
                    triggered_by: 'achievement',
                    details: {
                        achievement_id: achievement.id
                    },
                    timestamp: new Date()
                });
                await priceChange.save();
            }

            console.log(`🏆 Achievement unlocked: ${identity.username} - ${achievement.title} (+${achievement.points} pts)`);

            // Notify real-time service if available
            if (this.realtimeService && this.realtimeService.broadcastAchievementUnlock) {
                await this.realtimeService.broadcastAchievementUnlock({
                    tokenId,
                    achievement: achievementRecord,
                    timestamp: new Date(),
                    priceImpact: achievement.priceImpact,
                    newPrice: identity.currentPrice
                });
            }

            return true;
        } catch (error) {
            console.error('Error unlocking achievement:', error);
            return false;
        }
    }

    // Get all available achievements
    getAllAchievements(): Achievement[] {
        return this.achievements;
    }

    // Get achievements for a specific user
    async getUserAchievements(tokenId: number) {
        try {
            const identity = await Identity.findOne({ tokenId });
            if (!identity) return [];

            return identity.profile?.achievements || [];
        } catch (error) {
            console.error('Error getting user achievements:', error);
            return [];
        }
    }

    // Get achievement statistics
    async getAchievementStats() {
        try {
            const [totalAchievements, verifiedAchievements] = await Promise.all([
                AchievementHistory.countDocuments(),
                AchievementHistory.countDocuments({ verified: true })
            ]);

            const categoryStats = await AchievementHistory.aggregate([
                { $group: { _id: '$category', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]);

            return {
                totalAchievements,
                verifiedAchievements,
                verificationRate: totalAchievements > 0 ? (verifiedAchievements / totalAchievements) * 100 : 0,
                categoryBreakdown: categoryStats
            };
        } catch (error) {
            console.error('Error getting achievement stats:', error);
            return null;
        }
    }

    // Manual achievement check (for testing)
    async manualAchievementCheck(tokenId: number, trigger: string) {
        await this.checkAchievements(tokenId, trigger);
    }

    // Get achievement leaderboard
    async getAchievementLeaderboard(limit = 10) {
        try {
            return await Identity.find()
                .sort({ achievementCount: -1, reputationScore: -1 })
                .limit(limit)
                .select('tokenId username achievementCount reputationScore skillLevel isVerified')
                .lean();
        } catch (error) {
            console.error('Error getting achievement leaderboard:', error);
            return [];
        }
    }
}

export default AchievementService;