import express, { Request, Response } from 'express';
import Identity from '../models/Identity';
import GoalProgress from '../models/GoalProgress';
import AchievementHistory from '../models/AchievementHistory';
import PriceHistory from '../models/PriceHistory';
import DynamicNFTService from '../services/dynamicNFTService';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();
const nftService = new DynamicNFTService();

// ==================== GOAL CREATION & MANAGEMENT ====================

// Create goals for an identity
router.post('/create', async (req: Request, res: Response): Promise<void> => {
    try {
        const { tokenId, goals } = req.body;

        if (!tokenId || !Array.isArray(goals) || goals.length === 0) {
            res.status(400).json({
                success: false,
                error: 'Token ID and goals array are required'
            });
            return;
        }

        // Validate goals
        for (const goal of goals) {
            if (!goal.title || !goal.description || !goal.deadline || !goal.targetValue) {
                res.status(400).json({
                    success: false,
                    error: 'Each goal must have title, description, deadline, and targetValue'
                });
                return;
            }

            // Ensure deadline is in the future
            const deadline = new Date(goal.deadline);
            if (deadline <= new Date()) {
                res.status(400).json({
                    success: false,
                    error: 'Goal deadline must be in the future'
                });
                return;
            }
        }

        // Check if identity exists
        const identity = await Identity.findOne({ tokenId });
        if (!identity) {
            res.status(404).json({
                success: false,
                error: 'Identity not found'
            });
            return;
        }

        // Create goals using the NFT service
        const success = await nftService.createGoals(tokenId, goals);

        if (success) {
            res.json({
                success: true,
                message: `Created ${goals.length} goals for token ${tokenId}`,
                goals: goals.map((goal, index) => ({
                    ...goal,
                    goalIndex: index,
                    status: 'active'
                }))
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to create goals'
            });
        }

    } catch (error) {
        console.error('Error creating goals:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create goals'
        });
    }
});

// Update goal progress
router.post('/update-progress', async (req: Request, res: Response): Promise<void> => {
    try {
        const { tokenId, goalIndex, progress, proof } = req.body;

        if (tokenId === undefined || goalIndex === undefined || progress === undefined) {
            res.status(400).json({
                success: false,
                error: 'Token ID, goal index, and progress are required'
            });
            return;
        }

        // Find the goal
        const goalProgress = await GoalProgress.findOne({
            token_id: tokenId,
            goal_index: goalIndex
        });

        if (!goalProgress) {
            res.status(404).json({
                success: false,
                error: 'Goal not found'
            });
            return;
        }

        // Check if goal is already completed or failed
        if (goalProgress.completed) {
            res.status(400).json({
                success: false,
                error: 'Goal is already completed'
            });
            return;
        }

        if (goalProgress.failed) {
            res.status(400).json({
                success: false,
                error: 'Goal has failed and cannot be updated'
            });
            return;
        }

        // Update progress using NFT service
        const success = await nftService.updateGoalProgress(tokenId, goalIndex, progress, proof);

        if (success) {
            const updatedGoal = await GoalProgress.findOne({
                token_id: tokenId,
                goal_index: goalIndex
            });

            const progressPercentage = updatedGoal ? (updatedGoal.current_progress / updatedGoal.target_value) * 100 : 0;

            res.json({
                success: true,
                message: 'Goal progress updated',
                goalProgress: {
                    tokenId,
                    goalIndex,
                    currentProgress: updatedGoal?.current_progress,
                    targetValue: updatedGoal?.target_value,
                    progressPercentage: Math.min(100, progressPercentage),
                    completed: updatedGoal?.completed || false,
                    timeRemaining: updatedGoal ? Math.max(0, updatedGoal.deadline.getTime() - Date.now()) : 0
                }
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to update goal progress'
            });
        }

    } catch (error) {
        console.error('Error updating goal progress:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update goal progress'
        });
    }
});

// Complete goal manually (with proof)
router.post('/complete', async (req: Request, res: Response): Promise<void> => {
    try {
        const { tokenId, goalIndex, proof } = req.body;

        if (tokenId === undefined || goalIndex === undefined) {
            res.status(400).json({
                success: false,
                error: 'Token ID and goal index are required'
            });
            return;
        }

        const goalProgress = await GoalProgress.findOne({
            token_id: tokenId,
            goal_index: goalIndex
        });

        if (!goalProgress) {
            res.status(404).json({
                success: false,
                error: 'Goal not found'
            });
            return;
        }

        if (goalProgress.completed) {
            res.status(400).json({
                success: false,
                error: 'Goal is already completed'
            });
            return;
        }

        if (goalProgress.failed) {
            res.status(400).json({
                success: false,
                error: 'Failed goals cannot be completed'
            });
            return;
        }

        // Add proof if provided
        if (proof) {
            goalProgress.proof = {
                type: 'description',
                value: proof,
                submitted_at: new Date()
            };
            await goalProgress.save();
        }

        // Complete the goal
        const success = await nftService.completeGoal(tokenId, goalIndex);

        if (success) {
            const updatedGoal = await GoalProgress.findOne({
                token_id: tokenId,
                goal_index: goalIndex
            });

            const identity = await Identity.findOne({ tokenId });

            res.json({
                success: true,
                message: 'Goal completed successfully!',
                goalProgress: updatedGoal,
                rewards: {
                    reputationPoints: updatedGoal?.reward_points || 0,
                    priceIncrease: 'Calculated based on goal difficulty',
                    newReputationScore: identity?.reputationScore,
                    newPrice: identity?.currentPrice
                }
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to complete goal'
            });
        }

    } catch (error) {
        console.error('Error completing goal:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to complete goal'
        });
    }
});

// ==================== GOAL INFORMATION & ANALYTICS ====================

// Get goals for a specific token
router.get('/token/:tokenId', async (req: Request, res: Response): Promise<void> => {
    try {
        const tokenId = parseInt(req.params.tokenId);
        const includeStats = req.query.includeStats === 'true';

        if (isNaN(tokenId)) {
            res.status(400).json({
                success: false,
                error: 'Invalid token ID'
            });
            return;
        }

        const goals = await GoalProgress.find({ token_id: tokenId })
            .sort({ goal_index: 1 })
            .lean();

        if (goals.length === 0) {
            res.json({
                success: true,
                goals: [],
                totalGoals: 0,
                stats: {
                    completed: 0,
                    failed: 0,
                    active: 0,
                    successRate: 0
                }
            });
            return;
        }

        // Calculate progress percentages
        const enrichedGoals = goals.map(goal => ({
            ...goal,
            progressPercentage: (goal.current_progress / goal.target_value) * 100,
            timeRemaining: Math.max(0, goal.deadline.getTime() - Date.now()),
            isOverdue: new Date() > goal.deadline && !goal.completed && !goal.failed,
            status: goal.completed ? 'completed' : goal.failed ? 'failed' : 'active'
        }));

        let stats = {};
        if (includeStats) {
            const completed = goals.filter(g => g.completed).length;
            const failed = goals.filter(g => g.failed).length;
            const active = goals.filter(g => !g.completed && !g.failed).length;

            stats = {
                completed,
                failed,
                active,
                total: goals.length,
                successRate: (completed + failed) > 0 ? (completed / (completed + failed)) * 100 : 0,
                averageProgress: active > 0
                    ? goals.filter(g => !g.completed && !g.failed)
                        .reduce((sum, g) => sum + ((g.current_progress / g.target_value) * 100), 0) / active
                    : 0
            };
        }

        res.json({
            success: true,
            goals: enrichedGoals,
            totalGoals: goals.length,
            ...(includeStats && { stats })
        });

    } catch (error) {
        console.error('Error fetching goals:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch goals'
        });
    }
});

// Get goal leaderboard
router.get('/leaderboard', async (req: Request, res: Response): Promise<void> => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;
        const type = req.query.type as string || 'completion'; // 'completion' or 'success_rate'

        let leaderboard;

        if (type === 'success_rate') {
            // Leaderboard by success rate
            leaderboard = await GoalProgress.aggregate([
                {
                    $group: {
                        _id: '$token_id',
                        totalGoals: { $sum: 1 },
                        completedGoals: { $sum: { $cond: ['$completed', 1, 0] } },
                        failedGoals: { $sum: { $cond: ['$failed', 1, 0] } }
                    }
                },
                {
                    $match: {
                        $expr: { $gte: [{ $add: ['$completedGoals', '$failedGoals'] }, 3] } // At least 3 finished goals
                    }
                },
                {
                    $addFields: {
                        successRate: {
                            $multiply: [
                                { $divide: ['$completedGoals', { $add: ['$completedGoals', '$failedGoals'] }] },
                                100
                            ]
                        }
                    }
                },
                { $sort: { successRate: -1, completedGoals: -1 } },
                { $limit: limit }
            ]);
        } else {
            // Leaderboard by total completions
            leaderboard = await GoalProgress.aggregate([
                {
                    $group: {
                        _id: '$token_id',
                        totalGoals: { $sum: 1 },
                        completedGoals: { $sum: { $cond: ['$completed', 1, 0] } },
                        failedGoals: { $sum: { $cond: ['$failed', 1, 0] } },
                        activeGoals: { $sum: { $cond: [{ $and: [{ $not: '$completed' }, { $not: '$failed' }] }, 1, 0] } }
                    }
                },
                { $sort: { completedGoals: -1, totalGoals: -1 } },
                { $limit: limit }
            ]);
        }

        // Get identity information for each token
        const tokenIds = leaderboard.map(item => item._id);
        const identities = await Identity.find({ tokenId: { $in: tokenIds } })
            .select('tokenId username primarySkill reputationScore isVerified')
            .lean();

        const identityMap = identities.reduce((map, identity) => {
            map[identity.tokenId] = identity;
            return map;
        }, {} as { [key: number]: any });

        // Enrich leaderboard with identity data
        const enrichedLeaderboard = leaderboard.map((item, index) => ({
            rank: index + 1,
            tokenId: item._id,
            identity: identityMap[item._id],
            goalStats: {
                total: item.totalGoals,
                completed: item.completedGoals,
                failed: item.failedGoals,
                active: item.activeGoals || 0,
                successRate: type === 'success_rate' ? item.successRate :
                    (item.completedGoals + item.failedGoals) > 0
                        ? (item.completedGoals / (item.completedGoals + item.failedGoals)) * 100
                        : 0
            }
        }));

        res.json({
            success: true,
            leaderboard: enrichedLeaderboard,
            leaderboardType: type
        });

    } catch (error) {
        console.error('Error fetching goal leaderboard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch goal leaderboard'
        });
    }
});

// Get overdue goals (admin endpoint)
router.get('/overdue', async (req: Request, res: Response): Promise<void> => {
    try {
        const currentTime = new Date();
        const overdueGoals = await GoalProgress.find({
            deadline: { $lt: currentTime },
            completed: false,
            failed: false
        }).sort({ deadline: 1 }).lean();

        // Get identity information
        const tokenIds = [...new Set(overdueGoals.map(goal => goal.token_id))];
        const identities = await Identity.find({ tokenId: { $in: tokenIds } })
            .select('tokenId username ownerAddress')
            .lean();

        const identityMap = identities.reduce((map, identity) => {
            map[identity.tokenId] = identity;
            return map;
        }, {} as { [key: number]: any });

        const enrichedOverdueGoals = overdueGoals.map(goal => ({
            ...goal,
            identity: identityMap[goal.token_id],
            overdueDays: Math.floor((currentTime.getTime() - goal.deadline.getTime()) / (1000 * 60 * 60 * 24))
        }));

        res.json({
            success: true,
            overdueGoals: enrichedOverdueGoals,
            totalOverdue: overdueGoals.length
        });

    } catch (error) {
        console.error('Error fetching overdue goals:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch overdue goals'
        });
    }
});

// Process overdue goals (admin endpoint)
router.post('/process-overdue', async (req: Request, res: Response): Promise<void> => {
    try {
        const { tokenId, goalIndex } = req.body;

        if (tokenId && goalIndex !== undefined) {
            // Process specific goal
            const success = await nftService.failGoal(tokenId, goalIndex);

            if (success) {
                res.json({
                    success: true,
                    message: `Goal ${goalIndex} for token ${tokenId} marked as failed`
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to process overdue goal'
                });
            }
        } else {
            // Process all overdue goals
            await nftService.processOverdueGoals();

            res.json({
                success: true,
                message: 'All overdue goals processed'
            });
        }

    } catch (error) {
        console.error('Error processing overdue goals:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process overdue goals'
        });
    }
});

// ==================== GOAL TEMPLATES & SUGGESTIONS ====================

// Get goal templates
router.get('/templates', async (req: Request, res: Response): Promise<void> => {
    try {
        const skill = req.query.skill as string;
        const difficulty = req.query.difficulty as string;

        const templates = [
            {
                id: 'rep_milestone',
                title: 'Reputation Milestone',
                description: 'Reach {target} reputation points',
                category: 'reputation',
                suggestedTarget: 500,
                suggestedDuration: 30, // days
                difficulty: 'medium',
                rewardPoints: 50,
                penaltyPoints: 20
            },
            {
                id: 'skill_mastery',
                title: 'Skill Mastery',
                description: 'Complete {target} skill-related achievements',
                category: 'skills',
                suggestedTarget: 5,
                suggestedDuration: 60,
                difficulty: 'hard',
                rewardPoints: 100,
                penaltyPoints: 30
            },
            {
                id: 'community_engagement',
                title: 'Community Engagement',
                description: 'Get {target} profile views',
                category: 'social',
                suggestedTarget: 100,
                suggestedDuration: 14,
                difficulty: 'easy',
                rewardPoints: 25,
                penaltyPoints: 10
            },
            {
                id: 'achievement_hunter',
                title: 'Achievement Hunter',
                description: 'Unlock {target} achievements',
                category: 'achievements',
                suggestedTarget: 10,
                suggestedDuration: 45,
                difficulty: 'medium',
                rewardPoints: 75,
                penaltyPoints: 25
            },
            {
                id: 'learning_journey',
                title: 'Learning Journey',
                description: 'Complete {target} learning milestones',
                category: 'education',
                suggestedTarget: 3,
                suggestedDuration: 90,
                difficulty: 'expert',
                rewardPoints: 150,
                penaltyPoints: 50
            }
        ];

        let filteredTemplates = templates;

        if (difficulty) {
            filteredTemplates = filteredTemplates.filter(t => t.difficulty === difficulty);
        }

        // Add deadline suggestions
        const enrichedTemplates = filteredTemplates.map(template => {
            const deadline = new Date();
            deadline.setDate(deadline.getDate() + template.suggestedDuration);

            return {
                ...template,
                suggestedDeadline: deadline,
                estimatedReward: `${template.rewardPoints} reputation points + price increase`
            };
        });

        res.json({
            success: true,
            templates: enrichedTemplates,
            totalTemplates: enrichedTemplates.length
        });

    } catch (error) {
        console.error('Error fetching goal templates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch goal templates'
        });
    }
});

// Get goal statistics
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
    try {
        const [totalGoals, completedGoals, failedGoals, activeGoals] = await Promise.all([
            GoalProgress.countDocuments(),
            GoalProgress.countDocuments({ completed: true }),
            GoalProgress.countDocuments({ failed: true }),
            GoalProgress.countDocuments({ completed: false, failed: false })
        ]);

        const avgCompletionTime = await GoalProgress.aggregate([
            { $match: { completed: true } },
            {
                $addFields: {
                    completionTime: { $subtract: ['$completed_at', '$createdAt'] }
                }
            },
            {
                $group: {
                    _id: null,
                    avgTime: { $avg: '$completionTime' }
                }
            }
        ]);

        const successRate = (completedGoals + failedGoals) > 0
            ? (completedGoals / (completedGoals + failedGoals)) * 100
            : 0;

        res.json({
            success: true,
            stats: {
                totalGoals,
                completedGoals,
                failedGoals,
                activeGoals,
                successRate: Math.round(successRate * 100) / 100,
                averageCompletionTime: avgCompletionTime[0]?.avgTime
                    ? Math.round(avgCompletionTime[0].avgTime / (1000 * 60 * 60 * 24)) // Convert to days
                    : 0
            }
        });

    } catch (error) {
        console.error('Error fetching goal statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch goal statistics'
        });
    }
});

export default router;