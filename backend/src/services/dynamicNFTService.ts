// backend/src/services/dynamicNFTService.ts
import { ethers } from 'ethers';
import mongoose, { Document, Types } from 'mongoose';
import Identity from '../models/Identity';
import GoalProgress from '../models/GoalProgress';
import AchievementHistory from '../models/AchievementHistory';
import PriceHistory from '../models/PriceHistory';

/**
 * Minimal local TypeScript interfaces to satisfy type-checking for Mongoose documents.
 * These are intentionally minimal and non-invasive (do NOT change your Mongoose models).
 */
interface IGoalProgress extends Document {
    _id: Types.ObjectId;
    token_id: number;
    goal_index: number;
    title: string;
    description?: string;
    deadline: Date;
    target_value: number;
    progress_type?: 'percentage' | 'count' | 'boolean' | string;
    reward_points: number;
    penalty_points: number;
    current_progress: number;
    completed: boolean;
    failed: boolean;
    createdAt?: Date;
    completed_at?: Date;
    failed_at?: Date;
    proof?: any;
}

interface IIdentity extends Document {
    tokenId: number;
    username?: string;
    profile?: any;
    reputationScore: number;
    currentPrice: number;
    lastUpdate?: number | Date;
    isVerified?: boolean;
    achievementCount?: number;
    createdAt?: Date;
    skillLevel?: number;
    experience?: string;
    primarySkill?: string;
    lastMetadataUpdate?: number;
    lastKnownReputation?: number;
}

/** NFT metadata shape (unchanged) */
interface NFTMetadata {
    name: string;
    description: string;
    image: string;
    attributes: Array<{
        trait_type: string;
        value: string | number;
        display_type?: string;
    }>;
    properties: {
        reputation_score: number;
        skill_level: number;
        achievement_count: number;
        verification_status: boolean;
        created_date: string;
        last_updated: string;
        goals_completed: number;
        goals_failed: number;
        current_price: number;
        total_price_appreciation: number;
    };
}

interface GoalData {
    title: string;
    description: string;
    deadline: Date;
    targetValue: number;
    progressType: 'percentage' | 'count' | 'boolean';
    rewardPoints: number;
    penaltyPoints: number;
    difficulty: 'easy' | 'medium' | 'hard' | 'expert';
}

class DynamicNFTService {
    private provider: ethers.JsonRpcProvider;
    private contract?: ethers.Contract;
    private baseImageURL: string = 'https://api.somniaID.com/images';

    constructor() {
        const rpcUrl = process.env.RPC_URL || 'https://dream-rpc.somnia.network/';
        this.provider = new ethers.JsonRpcProvider(rpcUrl);

        if (process.env.CONTRACT_ADDRESS) {
            const contractABI = [
                "function updateTokenURI(uint256 tokenId, string memory newTokenURI) external",
                "function tokenURI(uint256 tokenId) external view returns (string)",
                "function getTokenMetadata(uint256 tokenId) external view returns (string)",
                "event MetadataUpdate(uint256 indexed tokenId, string newURI)",
                "event GoalCompleted(uint256 indexed tokenId, uint256 goalIndex, uint256 rewardPoints)",
                "event GoalFailed(uint256 indexed tokenId, uint256 goalIndex, uint256 pricePenalty)"
            ];

            try {
                this.contract = new ethers.Contract(
                    process.env.CONTRACT_ADDRESS,
                    contractABI,
                    this.provider
                );
            } catch (error) {
                console.warn('Contract initialization failed:', error);
            }
        }
    }

    // ==================== GOAL MANAGEMENT SYSTEM ====================

    // Create goals for an identity
    async createGoals(tokenId: number, goals: GoalData[]): Promise<boolean> {
        try {
            const identity = await Identity.findOne({ tokenId }) as unknown as IIdentity | null;
            if (!identity) {
                throw new Error('Identity not found');
            }

            // Create goal progress entries
            const goalPromises = goals.map(async (goal, index) => {
                const goalProgress = new GoalProgress({
                    token_id: tokenId,
                    goal_index: index,
                    title: goal.title,
                    description: goal.description,
                    deadline: goal.deadline,
                    target_value: goal.targetValue,
                    progress_type: goal.progressType,
                    reward_points: goal.rewardPoints,
                    penalty_points: goal.penaltyPoints,
                    current_progress: 0,
                    completed: false,
                    failed: false
                });

                return goalProgress.save();
            });

            await Promise.all(goalPromises);

            // Update identity with goal information
            if (!identity.profile) {
                identity.profile = {};
            }
            if (!identity.profile.goals) {
                identity.profile.goals = [];
            }

            goals.forEach((goal, index) => {
                identity.profile.goals.push({
                    id: `goal_${tokenId}_${index}_${Date.now()}`,
                    ...goal,
                    progress: 0,
                    createdAt: new Date()
                } as any);
            });

            identity.lastUpdate = Date.now();
            await identity.save();

            console.log(`✅ Created ${goals.length} goals for token ${tokenId}`);
            return true;

        } catch (error) {
            console.error('Error creating goals:', error);
            return false;
        }
    }

    // Update goal progress
    async updateGoalProgress(tokenId: number, goalIndex: number, newProgress: number, proof?: string): Promise<boolean> {
        try {
            const goalProgress = await GoalProgress.findOne({
                token_id: tokenId,
                goal_index: goalIndex
            }) as unknown as IGoalProgress | null;

            if (!goalProgress) {
                throw new Error('Goal not found');
            }

            // Don't update if already completed or failed
            if (goalProgress.completed || goalProgress.failed) {
                return false;
            }

            const oldProgress = goalProgress.current_progress;
            goalProgress.current_progress = Math.min(newProgress, goalProgress.target_value);

            // Add proof if provided
            if (proof) {
                goalProgress.proof = {
                    type: 'description',
                    value: proof,
                    submitted_at: new Date()
                };
            }

            // Check if goal is completed
            const progressPercentage = (goalProgress.current_progress / goalProgress.target_value) * 100;

            if (progressPercentage >= 100) {
                await this.completeGoal(tokenId, goalIndex);
            }

            await goalProgress.save();

            // Update identity profile goals
            const identity = await Identity.findOne({ tokenId }) as unknown as IIdentity | null;
            if (identity && identity.profile?.goals) {
                const profileGoal = identity.profile.goals.find((g: any) => g.id?.includes(`goal_${tokenId}_${goalIndex}`));
                if (profileGoal) {
                    profileGoal.progress = progressPercentage;
                    identity.lastUpdate = Date.now();
                    await identity.save();
                }
            }

            console.log(`📈 Goal progress updated: Token ${tokenId}, Goal ${goalIndex}: ${oldProgress} → ${newProgress}`);
            return true;

        } catch (error) {
            console.error('Error updating goal progress:', error);
            return false;
        }
    }

    // Complete a goal and award rewards
    async completeGoal(tokenId: number, goalIndex: number): Promise<boolean> {
        try {
            const goalProgress = await GoalProgress.findOne({
                token_id: tokenId,
                goal_index: goalIndex
            }) as unknown as IGoalProgress | null;

            if (!goalProgress || goalProgress.completed) {
                return false;
            }

            // Mark goal as completed
            goalProgress.completed = true;
            goalProgress.completed_at = new Date();
            await goalProgress.save();

            // Get identity for rewards
            const identity = await Identity.findOne({ tokenId }) as unknown as IIdentity | null;
            if (!identity) {
                throw new Error('Identity not found');
            }

            // Calculate rewards
            const rewardPoints = goalProgress.reward_points;
            const oldPrice = (typeof identity.currentPrice === 'number' && identity.currentPrice > 0) ? identity.currentPrice : 1;
            const priceReward = this.calculateGoalReward(goalProgress, oldPrice);
            const newPrice = oldPrice + priceReward;
            const priceChangePercent = ((newPrice - oldPrice) / oldPrice) * 100;

            // Apply rewards
            identity.reputationScore = (identity.reputationScore || 0) + rewardPoints;
            identity.currentPrice = newPrice;
            identity.lastUpdate = Date.now();

            // Update profile goals
            if (identity.profile?.goals) {
                const profileGoal = identity.profile.goals.find((g: any) => g.id?.includes(`goal_${tokenId}_${goalIndex}`));
                if (profileGoal) {
                    (profileGoal as any).completed = true;
                    (profileGoal as any).progress = 100;
                    (profileGoal as any).completedAt = new Date();
                }
            }

            await identity.save();

            // Record achievement for goal completion
            const completionAchievement = new AchievementHistory({
                token_id: tokenId,
                title: `Goal Achieved: ${goalProgress.title}`,
                description: goalProgress.description,
                points: rewardPoints,
                price_impact: Math.round(priceReward * 10000), // Convert to basis points
                category: 'milestone',
                verified: true,
                timestamp: new Date()
            });
            await completionAchievement.save();

            // Record price change
            const priceHistory = new PriceHistory({
                token_id: tokenId,
                old_price: oldPrice,
                new_price: newPrice,
                price_change_percent: priceChangePercent,
                change_reason: `Goal completed: ${goalProgress.title}`,
                triggered_by: 'goal_completion',
                details: {
                    goal_id: (goalProgress._id && typeof (goalProgress._id as any).toString === 'function')
                        ? (goalProgress._id as any).toString()
                        : (goalProgress as any).id || 'unknown'
                },
                timestamp: new Date()
            });
            await priceHistory.save();

            console.log(`🎯 Goal completed: Token ${tokenId}, Goal "${goalProgress.title}" (+${rewardPoints} rep, +${priceReward.toFixed(4)} ETH)`);

            // Emit goal completion event (if contract available)
            if (this.contract) {
                try {
                    // This would emit an event if we had a wallet connected
                    console.log(`🔔 Goal completion event should be emitted for token ${tokenId}`);
                } catch (eventError) {
                    console.warn('Could not emit goal completion event:', eventError);
                }
            }

            return true;

        } catch (error) {
            console.error('Error completing goal:', error);
            return false;
        }
    }

    // Fail a goal due to deadline
    async failGoal(tokenId: number, goalIndex: number): Promise<boolean> {
        try {
            const goalProgress = await GoalProgress.findOne({
                token_id: tokenId,
                goal_index: goalIndex
            }) as unknown as IGoalProgress | null;

            if (!goalProgress || goalProgress.completed || goalProgress.failed) {
                return false;
            }

            // Mark goal as failed
            goalProgress.failed = true;
            goalProgress.failed_at = new Date();
            await goalProgress.save();

            // Get identity for penalties
            const identity = await Identity.findOne({ tokenId }) as unknown as IIdentity | null;
            if (!identity) {
                throw new Error('Identity not found');
            }

            // Apply penalties
            const penaltyPoints = goalProgress.penalty_points;
            const oldPrice = (typeof identity.currentPrice === 'number' && identity.currentPrice > 0) ? identity.currentPrice : 1;
            const pricePenalty = (oldPrice * penaltyPoints) / 10000; // Convert from basis points
            const newPrice = Math.max(1, oldPrice - pricePenalty); // Minimum price of 1 ETH
            const priceChangePercent = ((newPrice - oldPrice) / oldPrice) * 100;

            identity.reputationScore = Math.max(0, (identity.reputationScore || 0) - penaltyPoints);
            identity.currentPrice = newPrice;
            identity.lastUpdate = Date.now();

            // Update profile goals
            if (identity.profile?.goals) {
                const profileGoal = identity.profile.goals.find((g: any) => g.id?.includes(`goal_${tokenId}_${goalIndex}`));
                if (profileGoal) {
                    (profileGoal as any).failed = true;
                    (profileGoal as any).failedAt = new Date();
                }
            }

            await identity.save();

            // Record price penalty
            if (pricePenalty > 0) {
                const priceHistory = new PriceHistory({
                    token_id: tokenId,
                    old_price: oldPrice,
                    new_price: newPrice,
                    price_change_percent: priceChangePercent,
                    change_reason: `Goal deadline missed: ${goalProgress.title}`,
                    triggered_by: 'goal_failure',
                    details: {
                        goal_id: (goalProgress._id && typeof (goalProgress._id as any).toString === 'function')
                            ? (goalProgress._id as any).toString()
                            : (goalProgress as any).id || 'unknown'
                    },
                    timestamp: new Date()
                });
                await priceHistory.save();
            }

            console.log(`❌ Goal failed: Token ${tokenId}, Goal "${goalProgress.title}" (-${penaltyPoints} rep, -${pricePenalty.toFixed(4)} ETH)`);
            return true;

        } catch (error) {
            console.error('Error failing goal:', error);
            return false;
        }
    }

    // Check for overdue goals and process failures
    async processOverdueGoals(): Promise<void> {
        try {
            const currentTime = new Date();
            const overdueGoals = await GoalProgress.find({
                deadline: { $lt: currentTime },
                completed: false,
                failed: false
            }) as unknown as IGoalProgress[];

            console.log(`🕒 Processing ${overdueGoals.length} overdue goals...`);

            for (const goal of overdueGoals) {
                // goal is assumed to be an IGoalProgress-like doc
                await this.failGoal(goal.token_id, goal.goal_index);
            }

            if (overdueGoals.length > 0) {
                console.log(`✅ Processed ${overdueGoals.length} overdue goals`);
            }

        } catch (error) {
            console.error('Error processing overdue goals:', error);
        }
    }

    // ==================== ENHANCED METADATA GENERATION ====================

    // Generate dynamic NFT image with goal indicators
    private generateImageURL(identity: any, goalStats?: any): string {
        const params = new URLSearchParams({
            username: identity.username || 'unknown',
            skill: identity.primarySkill || 'n/a',
            level: String(identity.skillLevel || 0),
            reputation: String(identity.reputationScore || 0),
            achievements: String(identity.achievementCount || 0),
            verified: String(identity.isVerified || false),
            price: String(identity.currentPrice || 0)
        });

        // Add goal indicators
        if (goalStats) {
            params.append('goalsCompleted', String(goalStats.completed || 0));
            params.append('goalsFailed', String(goalStats.failed || 0));
            params.append('goalsActive', String(goalStats.active || 0));
        }

        return `${this.baseImageURL}/generate?${params.toString()}`;
    }

    // Generate enhanced metadata with goal tracking
    async generateMetadata(tokenId: number): Promise<NFTMetadata> {
        const identity = await Identity.findOne({ tokenId }) as unknown as IIdentity | null;
        if (!identity) {
            throw new Error('Identity not found');
        }

        // Get goal statistics, achievement and price history in parallel
        const [goalStatsAgg, achievementHistory, priceHistory] = await Promise.all([
            GoalProgress.aggregate([
                { $match: { token_id: tokenId } },
                {
                    $group: {
                        _id: null,
                        completed: { $sum: { $cond: ['$completed', 1, 0] } },
                        failed: { $sum: { $cond: ['$failed', 1, 0] } },
                        active: { $sum: { $cond: [{ $and: [{ $not: '$completed' }, { $not: '$failed' }] }, 1, 0] } }
                    }
                }
            ]) as any,
            AchievementHistory.find({ token_id: tokenId }).lean() as Promise<any>,
            PriceHistory.find({ token_id: tokenId }).sort({ timestamp: 1 }).lean() as Promise<any>
        ]);

        const goals = (Array.isArray(goalStatsAgg) && goalStatsAgg[0]) ? goalStatsAgg[0] : { completed: 0, failed: 0, active: 0 };
        const parsedPriceHistory: any[] = Array.isArray(priceHistory) ? priceHistory : [];

        const totalPriceAppreciation = parsedPriceHistory.length > 0
            ? (parsedPriceHistory[parsedPriceHistory.length - 1].new_price - parsedPriceHistory[0].old_price)
            : 0;

        const metadata: NFTMetadata = {
            name: `${identity.username || 'User'} - SomniaID #${tokenId}`,
            description: `Dynamic reputation NFT for ${identity.username || 'user'}. ${identity.profile?.bio || 'Building the future on Somnia Network.'} Goals: ${goals.completed} completed, ${goals.active} active.`,
            image: this.generateImageURL(identity, goals),
            attributes: [
                {
                    trait_type: "Reputation Score",
                    value: identity.reputationScore || 0,
                    display_type: "number"
                },
                {
                    trait_type: "Skill Level",
                    value: identity.skillLevel || 0,
                    display_type: "number"
                },
                {
                    trait_type: "Primary Skill",
                    value: identity.primarySkill || 'n/a'
                },
                {
                    trait_type: "Experience Level",
                    value: identity.experience || 'beginner'
                },
                {
                    trait_type: "Achievement Count",
                    value: identity.achievementCount || 0,
                    display_type: "number"
                },
                {
                    trait_type: "Goals Completed",
                    value: goals.completed || 0,
                    display_type: "number"
                },
                {
                    trait_type: "Goals Failed",
                    value: goals.failed || 0,
                    display_type: "number"
                },
                {
                    trait_type: "Active Goals",
                    value: goals.active || 0,
                    display_type: "number"
                },
                {
                    trait_type: "Goal Success Rate",
                    value: (goals.completed + goals.failed) > 0
                        ? Math.round((goals.completed / (goals.completed + goals.failed)) * 100)
                        : 0,
                    display_type: "number"
                },
                {
                    trait_type: "Verification Status",
                    value: identity.isVerified ? "Verified" : "Unverified"
                },
                {
                    trait_type: "Current Price",
                    value: identity.currentPrice || 0,
                    display_type: "number"
                },
                {
                    trait_type: "Total Appreciation",
                    value: Math.round(totalPriceAppreciation * 100) / 100,
                    display_type: "number"
                }
            ],
            properties: {
                reputation_score: identity.reputationScore || 0,
                skill_level: identity.skillLevel || 0,
                achievement_count: identity.achievementCount || 0,
                verification_status: !!identity.isVerified,
                created_date: identity.createdAt?.toISOString() || new Date().toISOString(),
                last_updated: new Date(identity.lastUpdate || Date.now()).toISOString(),
                goals_completed: goals.completed || 0,
                goals_failed: goals.failed || 0,
                current_price: identity.currentPrice || 0,
                total_price_appreciation: totalPriceAppreciation
            }
        };

        // Add goal-specific attributes (unchanged logic)
        if (goals.completed > 5) {
            metadata.attributes.push({
                trait_type: "Goal Achiever",
                value: "Yes"
            });
        }

        if (goals.completed > 0 && goals.failed === 0) {
            metadata.attributes.push({
                trait_type: "Perfect Record",
                value: "Yes"
            });
        }

        return metadata;
    }

    // ==================== HELPER METHODS ====================

    private calculateGoalReward(goalProgress: any, currentPrice: number): number {
        const baseReward = currentPrice * 0.02; // 2% base reward

        // Difficulty multiplier
        const difficultyMultipliers: { [key: string]: number } = {
            'easy': 1.0,
            'medium': 1.5,
            'hard': 2.0,
            'expert': 3.0
        };

        // Time bonus for early completion (defensive checks)
        const deadlineTime = goalProgress.deadline ? new Date(goalProgress.deadline).getTime() : Date.now();
        const completedAt = goalProgress.completed_at ? new Date(goalProgress.completed_at).getTime() : Date.now();
        const createdAt = goalProgress.createdAt ? new Date(goalProgress.createdAt).getTime() : (completedAt || Date.now());
        const timeRemaining = Math.max(0, deadlineTime - completedAt);
        const totalTime = Math.max(1, deadlineTime - createdAt);
        const timeBonus = Math.max(0, timeRemaining / totalTime) * 0.5; // Up to 50% bonus

        // Safely pick difficulty multiplier
        const difficultyKey = goalProgress.difficulty || 'medium';
        const multiplierBase = difficultyMultipliers[difficultyKey] || difficultyMultipliers['medium'];

        const multiplier = multiplierBase * (1 + timeBonus);

        return baseReward * multiplier;
    }

    // Schedule automatic goal deadline checking
    startGoalMonitoring(): void {
        // Check for overdue goals every hour
        const checkInterval = 60 * 60 * 1000; // 1 hour

        setInterval(async () => {
            try {
                await this.processOverdueGoals();
            } catch (error) {
                console.error('Error in goal monitoring:', error);
            }
        }, checkInterval);

        console.log('🕒 Goal monitoring started - checking every hour for overdue goals');
    }

    // ==================== EXISTING METHODS (Keep as is) ====================

    async updateOnChainMetadata(tokenId: number, privateKey?: string): Promise<boolean> {
        try {
            if (!this.contract || !privateKey) {
                console.log('Contract or private key not available, skipping on-chain update');
                return false;
            }

            const metadata = await this.generateMetadata(tokenId);
            const metadataURI = await this.uploadMetadata(metadata);
            const wallet = new ethers.Wallet(privateKey, this.provider);
            const contractWithSigner = this.contract.connect(wallet);

            if ('updateTokenURI' in contractWithSigner) {
                const tx = await (contractWithSigner as any).updateTokenURI(tokenId, metadataURI);
                await tx.wait();

                console.log(`NFT metadata updated on-chain for token ${tokenId}: ${tx.hash}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error updating on-chain metadata:', error);
            return false;
        }
    }

    private async uploadMetadata(metadata: NFTMetadata): Promise<string> {
        const metadataString = JSON.stringify(metadata, null, 2);

        // ethers.keccak256 + toUtf8Bytes used in your original code; keep same usage
        // If your project uses ethers v6, these functions are on the top-level namespace as used below.
        const hash = (ethers.keccak256(ethers.toUtf8Bytes(metadataString)) || '').slice(2, 10);
        return `https://gateway.pinata.cloud/ipfs/Qm${hash}`;
    }

    async getOnChainMetadata(tokenId: number): Promise<string | null> {
        try {
            if (!this.contract) return null;

            if ('tokenURI' in this.contract) {
                const tokenURI = await (this.contract as any).tokenURI(tokenId);
                return tokenURI;
            }
            return null;
        } catch (error) {
            console.error('Error getting on-chain metadata:', error);
            return null;
        }
    }

    async scheduleMetadataUpdate(tokenId: number) {
        try {
            const identity = await Identity.findOne({ tokenId }) as unknown as IIdentity | null;
            if (!identity) return;

            const shouldUpdate = await this.shouldUpdateMetadata(identity);

            if (shouldUpdate) {
                await this.updateOnChainMetadata(tokenId);

                identity.lastMetadataUpdate = Date.now();
                await identity.save();
            }
        } catch (error) {
            console.error('Error scheduling metadata update:', error);
        }
    }

    private async shouldUpdateMetadata(identity: any): Promise<boolean> {
        const lastUpdate = identity.lastMetadataUpdate || 0;
        const timeSinceUpdate = Date.now() - lastUpdate;
        const oneHour = 60 * 60 * 1000;

        // Check if there are recent goal updates (defensive: ensure identity.tokenId exists)
        const tokenId = identity.tokenId || identity.token_id || 0;

        const recentGoalUpdates = await GoalProgress.countDocuments({
            token_id: tokenId,
            $or: [
                { completed_at: { $gte: new Date(lastUpdate) } },
                { failed_at: { $gte: new Date(lastUpdate) } }
            ]
        });

        return (
            lastUpdate === 0 ||
            timeSinceUpdate > oneHour ||
            identity.reputationScore > (identity.lastKnownReputation || 0) + 50 ||
            recentGoalUpdates > 0
        );
    }

    async batchUpdateMetadata(tokenIds: number[]) {
        const results: Array<{ tokenId: number; success: boolean; error?: string }> = [];

        for (const tokenId of tokenIds) {
            try {
                const success = await this.updateOnChainMetadata(tokenId);
                results.push({ tokenId, success });

                // throttle to avoid hitting rate limits
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results.push({ tokenId, success: false, error: errorMessage });
            }
        }

        return results;
    }
}

export default DynamicNFTService;
