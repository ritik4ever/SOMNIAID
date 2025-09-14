import Identity from '../models/Identity';
import RealtimeService from './realtimeService';

interface Achievement {
    id: string;
    title: string;
    description: string;
    category: 'milestone' | 'social' | 'skill' | 'time' | 'special';
    badge: string; // URL to badge image
    points: number;
    valueImpact: number; // Impact on NFT price
    requirements: {
        type: 'reputation' | 'achievements' | 'time' | 'social' | 'custom';
        value: any;
        operator?: 'gte' | 'lte' | 'eq';
    }[];
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    unlockedBy?: number; // Number of users who unlocked this
}

class AchievementService {
    private realtimeService?: RealtimeService;
    private achievements: Achievement[] = [];

    constructor(realtimeService?: RealtimeService) {
        this.realtimeService = realtimeService;
        this.initializeAchievements();
    }

    // Initialize all possible achievements
    private initializeAchievements() {
        this.achievements = [
            // Milestone Achievements
            {
                id: 'first_identity',
                title: 'Welcome to Somnia',
                description: 'Created your first SomniaID identity',
                category: 'milestone',
                badge: '/badges/welcome.png',
                points: 50,
                valueImpact: 5,
                requirements: [{ type: 'custom', value: 'identity_created' }],
                rarity: 'common'
            },
            {
                id: 'reputation_100',
                title: 'Rising Star',
                description: 'Reached 100 reputation points',
                category: 'milestone',
                badge: '/badges/rising_star.png',
                points: 25,
                valueImpact: 3,
                requirements: [{ type: 'reputation', value: 100, operator: 'gte' }],
                rarity: 'common'
            },
            {
                id: 'reputation_500',
                title: 'Skilled Developer',
                description: 'Reached 500 reputation points',
                category: 'milestone',
                badge: '/badges/skilled_dev.png',
                points: 100,
                valueImpact: 10,
                requirements: [{ type: 'reputation', value: 500, operator: 'gte' }],
                rarity: 'uncommon'
            },
            {
                id: 'reputation_1000',
                title: 'Expert Builder',
                description: 'Reached 1000 reputation points',
                category: 'milestone',
                badge: '/badges/expert.png',
                points: 250,
                valueImpact: 25,
                requirements: [{ type: 'reputation', value: 1000, operator: 'gte' }],
                rarity: 'rare'
            },
            {
                id: 'reputation_2500',
                title: 'Somnia Legend',
                description: 'Reached 2500 reputation points',
                category: 'milestone',
                badge: '/badges/legend.png',
                points: 500,
                valueImpact: 50,
                requirements: [{ type: 'reputation', value: 2500, operator: 'gte' }],
                rarity: 'legendary'
            },

            // Achievement Count Milestones
            {
                id: 'first_achievement',
                title: 'Achievement Hunter',
                description: 'Unlocked your first achievement',
                category: 'milestone',
                badge: '/badges/hunter.png',
                points: 25,
                valueImpact: 2,
                requirements: [{ type: 'achievements', value: 1, operator: 'gte' }],
                rarity: 'common'
            },
            {
                id: 'achievement_collector',
                title: 'Achievement Collector',
                description: 'Unlocked 10 achievements',
                category: 'milestone',
                badge: '/badges/collector.png',
                points: 100,
                valueImpact: 8,
                requirements: [{ type: 'achievements', value: 10, operator: 'gte' }],
                rarity: 'uncommon'
            },
            {
                id: 'achievement_master',
                title: 'Achievement Master',
                description: 'Unlocked 25 achievements',
                category: 'milestone',
                badge: '/badges/master.png',
                points: 300,
                valueImpact: 20,
                requirements: [{ type: 'achievements', value: 25, operator: 'gte' }],
                rarity: 'epic'
            },

            // Time-based Achievements
            {
                id: 'early_adopter',
                title: 'Early Adopter',
                description: 'One of the first 100 users on SomniaID',
                category: 'time',
                badge: '/badges/early_adopter.png',
                points: 200,
                valueImpact: 15,
                requirements: [{ type: 'custom', value: 'early_adopter' }],
                rarity: 'rare'
            },
            {
                id: 'beta_tester',
                title: 'Beta Tester',
                description: 'Joined during beta testing phase',
                category: 'time',
                badge: '/badges/beta_tester.png',
                points: 150,
                valueImpact: 12,
                requirements: [{ type: 'custom', value: 'beta_tester' }],
                rarity: 'uncommon'
            },

            // Social Achievements
            {
                id: 'verified_identity',
                title: 'Verified User',
                description: 'Successfully verified your identity',
                category: 'social',
                badge: '/badges/verified.png',
                points: 200,
                valueImpact: 20,
                requirements: [{ type: 'custom', value: 'verified' }],
                rarity: 'uncommon'
            },

            // Skill-based Achievements
            {
                id: 'hackathon_winner',
                title: 'Hackathon Champion',
                description: 'Won a hackathon competition',
                category: 'skill',
                badge: '/badges/champion.png',
                points: 500,
                valueImpact: 40,
                requirements: [{ type: 'custom', value: 'hackathon_win' }],
                rarity: 'epic'
            },
            {
                id: 'certifications_expert',
                title: 'Certification Expert',
                description: 'Earned 5 or more certifications',
                category: 'skill',
                badge: '/badges/cert_expert.png',
                points: 300,
                valueImpact: 25,
                requirements: [{ type: 'custom', value: 'certifications_5' }],
                rarity: 'rare'
            },

            // Special Events
            {
                id: 'genesis_user',
                title: 'Genesis User',
                description: 'Minted one of the first 10 SomniaIDs',
                category: 'special',
                badge: '/badges/genesis.png',
                points: 1000,
                valueImpact: 100,
                requirements: [{ type: 'custom', value: 'genesis' }],
                rarity: 'legendary'
            }
        ];
    }

    // Check and unlock achievements for a user
    async checkAndUnlockAchievements(tokenId: number, trigger?: string) {
        try {
            const identity = await Identity.findOne({ tokenId });
            if (!identity) return [];

            const unlockedAchievements = [];
            const currentAchievementIds = identity.profile?.achievements?.map(a => a.id) || [];

            for (const achievement of this.achievements) {
                // Skip if already unlocked
                if (currentAchievementIds.includes(achievement.id)) continue;

                // Check if requirements are met
                const meetsRequirements = await this.checkRequirements(identity, achievement, trigger);

                if (meetsRequirements) {
                    await this.unlockAchievement(tokenId, achievement);
                    unlockedAchievements.push(achievement);
                }
            }

            return unlockedAchievements;
        } catch (error) {
            console.error('Error checking achievements:', error);
            return [];
        }
    }

    // Check if user meets achievement requirements
    private async checkRequirements(identity: any, achievement: Achievement, trigger?: string): Promise<boolean> {
        for (const requirement of achievement.requirements) {
            switch (requirement.type) {
                case 'reputation':
                    const meetsReputation = this.compareValue(
                        identity.reputationScore,
                        requirement.value,
                        requirement.operator || 'gte'
                    );
                    if (!meetsReputation) return false;
                    break;

                case 'achievements':
                    const achievementCount = identity.profile?.achievements?.length || 0;
                    const meetsAchievements = this.compareValue(
                        achievementCount,
                        requirement.value,
                        requirement.operator || 'gte'
                    );
                    if (!meetsAchievements) return false;
                    break;

                case 'time':
                    const accountAge = Date.now() - (identity.createdAt?.getTime() || Date.now());
                    const meetsTime = this.compareValue(
                        accountAge,
                        requirement.value,
                        requirement.operator || 'gte'
                    );
                    if (!meetsTime) return false;
                    break;

                case 'custom':
                    const meetsCustom = await this.checkCustomRequirement(identity, requirement.value, trigger);
                    if (!meetsCustom) return false;
                    break;
            }
        }

        return true;
    }

    // Check custom requirements
    private async checkCustomRequirement(identity: any, value: string, trigger?: string): Promise<boolean> {
        switch (value) {
            case 'identity_created':
                return trigger === 'identity_created';

            case 'verified':
                return identity.isVerified;

            case 'hackathon_win':
                const hackathonWins = identity.profile?.achievements?.filter(
                    (a: any) => a.category === 'hackathon'
                ).length || 0;
                return hackathonWins > 0;

            case 'certifications_5':
                const certifications = identity.profile?.achievements?.filter(
                    (a: any) => a.category === 'certification'
                ).length || 0;
                return certifications >= 5;

            case 'early_adopter':
                const userCount = await Identity.countDocuments();
                return userCount <= 100;

            case 'beta_tester':
                const createdAt = identity.createdAt?.getTime() || Date.now();
                const betaEndDate = new Date('2024-12-31').getTime(); // Example beta end date
                return createdAt < betaEndDate;

            case 'genesis':
                return identity.tokenId <= 10;

            default:
                return false;
        }
    }

    // Utility function to compare values
    private compareValue(actual: number, expected: number, operator: string): boolean {
        switch (operator) {
            case 'gte': return actual >= expected;
            case 'lte': return actual <= expected;
            case 'eq': return actual === expected;
            default: return false;
        }
    }

    // Unlock achievement for user
    private async unlockAchievement(tokenId: number, achievement: Achievement) {
        try {
            const identity = await Identity.findOne({ tokenId });
            if (!identity) return;

            // Add achievement to user's profile
            const achievementRecord = {
                id: achievement.id,
                title: achievement.title,
                description: achievement.description,
                category: achievement.category as any,
                badge: achievement.badge,
                points: achievement.points,
                valueImpact: achievement.valueImpact,
                rarity: achievement.rarity,
                dateAchieved: new Date(),
                verified: true
            };

            identity.profile.achievements.push(achievementRecord);
            identity.achievementCount = identity.profile.achievements.length;

            // Update reputation and NFT price
            identity.reputationScore += achievement.points;
            identity.currentPrice += achievement.valueImpact;
            identity.lastUpdate = Date.now();

            await identity.save();

            // Update achievement unlock count
            achievement.unlockedBy = (achievement.unlockedBy || 0) + 1;

            // Emit real-time notification
            if (this.realtimeService) {
                await this.realtimeService.unlockAchievement(tokenId, achievementRecord);
            }

            console.log(`Achievement unlocked: ${identity.username} - ${achievement.title}`);
        } catch (error) {
            console.error('Error unlocking achievement:', error);
        }
    }

    // Get all available achievements
    getAllAchievements(): Achievement[] {
        return this.achievements.map(achievement => ({
            ...achievement,
            unlockedBy: achievement.unlockedBy || 0
        }));
    }

    // Get user's achievements with progress
    async getUserAchievements(tokenId: number) {
        const identity = await Identity.findOne({ tokenId });
        if (!identity) return { unlocked: [], available: [] };

        const unlocked = identity.profile?.achievements || [];
        const unlockedIds = unlocked.map((a: any) => a.id);

        const available = this.achievements.filter(a => !unlockedIds.includes(a.id));

        return { unlocked, available };
    }

    // Get achievement statistics
    async getAchievementStats() {
        const totalUsers = await Identity.countDocuments();
        const achievementStats = [];

        for (const achievement of this.achievements) {
            const unlockedCount = await Identity.countDocuments({
                'profile.achievements.id': achievement.id
            });

            achievementStats.push({
                ...achievement,
                unlockedCount,
                unlockedPercentage: totalUsers > 0 ? (unlockedCount / totalUsers) * 100 : 0
            });
        }

        return achievementStats;
    }

    // Manually trigger achievement check
    async manualAchievementCheck(tokenId: number, trigger: string) {
        return await this.checkAndUnlockAchievements(tokenId, trigger);
    }

    // Get achievement leaderboard
    async getAchievementLeaderboard(limit = 10) {
        return await Identity.find()
            .sort({ achievementCount: -1, reputationScore: -1 })
            .limit(limit)
            .select('tokenId username achievementCount reputationScore profile.achievements')
            .lean();
    }
}

export default AchievementService;