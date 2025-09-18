import { Server } from 'socket.io';
import Identity from '../models/Identity';
import NFTTransfer from '../models/NFTTransfer';
import AchievementHistory from '../models/AchievementHistory';
import GoalProgress from '../models/GoalProgress';
import PriceHistory from '../models/PriceHistory';

interface ReputationUpdate {
    tokenId: number;
    oldScore: number;
    newScore: number;
    reason: string;
    timestamp: Date;
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

interface NFTPurchase {
    tokenId: number;
    buyer: string;
    seller: string;
    price: number;
    txHash: string;
    timestamp: Date;
}

interface PriceUpdate {
    tokenId: number;
    oldPrice: number;
    newPrice: number;
    changePercent: number;
    reason: string;
    timestamp: Date;
}

interface GoalUpdate {
    tokenId: number;
    goalIndex: number;
    type: 'progress' | 'completed' | 'failed';
    progress?: number;
    reward?: number;
    penalty?: number;
    timestamp: Date;
}

class RealtimeService {
    private io: Server;
    private connectedUsers: Map<string, { socketId: string; tokenId?: number; address?: string }> = new Map();
    private roomSubscriptions: Map<string, Set<string>> = new Map(); // room -> socket IDs

    constructor(io: Server) {
        this.io = io;
        this.setupEventHandlers();
        this.startPeriodicUpdates();
    }

    private setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`User connected: ${socket.id}`);

            // Join user-specific room
            socket.on('join_user', (data: { tokenId?: number; address?: string }) => {
                this.connectedUsers.set(socket.id, {
                    socketId: socket.id,
                    tokenId: data.tokenId,
                    address: data.address?.toLowerCase()
                });

                if (data.tokenId) {
                    socket.join(`user_${data.tokenId}`);
                    this.addToRoom(`user_${data.tokenId}`, socket.id);
                }

                if (data.address) {
                    socket.join(`address_${data.address.toLowerCase()}`);
                    this.addToRoom(`address_${data.address.toLowerCase()}`, socket.id);
                }

                console.log(`User joined: TokenID ${data.tokenId}, Address ${data.address}`);
            });

            // Track specific NFT
            socket.on('track_nft', (tokenId: number) => {
                socket.join(`nft_${tokenId}`);
                this.addToRoom(`nft_${tokenId}`, socket.id);
                console.log(`Tracking NFT ${tokenId}`);
            });

            // Track portfolio for address
            socket.on('track_portfolio', (address: string) => {
                socket.join(`portfolio_${address.toLowerCase()}`);
                this.addToRoom(`portfolio_${address.toLowerCase()}`, socket.id);
                console.log(`Tracking portfolio for ${address}`);
            });

            // Track marketplace
            socket.on('track_marketplace', () => {
                socket.join('marketplace');
                this.addToRoom('marketplace', socket.id);
                console.log('Tracking marketplace');
            });

            // Track leaderboard
            socket.on('track_leaderboard', () => {
                socket.join('leaderboard');
                this.addToRoom('leaderboard', socket.id);
                console.log('Tracking leaderboard');
            });

            // Track price updates for specific token
            socket.on('track_price', (tokenId: number) => {
                socket.join(`price_${tokenId}`);
                this.addToRoom(`price_${tokenId}`, socket.id);
                console.log(`Tracking price for token ${tokenId}`);
            });

            // Track global activity feed
            socket.on('track_activity', () => {
                socket.join('activity_feed');
                this.addToRoom('activity_feed', socket.id);
                console.log('Tracking activity feed');
            });

            // Handle disconnect
            socket.on('disconnect', () => {
                this.connectedUsers.delete(socket.id);
                this.removeFromAllRooms(socket.id);
                console.log(`User disconnected: ${socket.id}`);
            });
        });
    }

    // ==================== ROOM MANAGEMENT ====================

    private addToRoom(room: string, socketId: string) {
        if (!this.roomSubscriptions.has(room)) {
            this.roomSubscriptions.set(room, new Set());
        }
        this.roomSubscriptions.get(room)!.add(socketId);
    }

    private removeFromAllRooms(socketId: string) {
        this.roomSubscriptions.forEach((sockets, room) => {
            sockets.delete(socketId);
            if (sockets.size === 0) {
                this.roomSubscriptions.delete(room);
            }
        });
    }

    // ==================== NFT MARKETPLACE EVENTS ====================

    // Broadcast NFT purchase
    async broadcastNFTPurchase(purchaseData: NFTPurchase) {
        try {
            const identity = await Identity.findOne({ tokenId: purchaseData.tokenId });

            const enrichedData = {
                ...purchaseData,
                username: identity?.username || `Token #${purchaseData.tokenId}`,
                primarySkill: identity?.primarySkill,
                priceETH: purchaseData.price,
                priceUSD: purchaseData.price * 3000 // Mock ETH price
            };

            // Emit to specific rooms
            this.io.to(`nft_${purchaseData.tokenId}`).emit('nft_purchased', enrichedData);
            this.io.to(`address_${purchaseData.buyer}`).emit('nft_purchased_by_you', enrichedData);
            this.io.to(`address_${purchaseData.seller}`).emit('nft_sold_by_you', enrichedData);
            this.io.to(`portfolio_${purchaseData.buyer}`).emit('portfolio_updated', { type: 'purchase', data: enrichedData });
            this.io.to(`portfolio_${purchaseData.seller}`).emit('portfolio_updated', { type: 'sale', data: enrichedData });
            this.io.to('marketplace').emit('marketplace_transaction', enrichedData);
            this.io.to('activity_feed').emit('activity_update', {
                type: 'nft_purchase',
                ...enrichedData,
                timestamp: new Date()
            });

            console.log(`🔔 NFT Purchase broadcasted: Token ${purchaseData.tokenId} sold for ${purchaseData.price} ETH`);
        } catch (error) {
            console.error('Error broadcasting NFT purchase:', error);
        }
    }

    // Broadcast price update
    async broadcastPriceUpdate(priceData: PriceUpdate) {
        try {
            const identity = await Identity.findOne({ tokenId: priceData.tokenId });

            const enrichedData = {
                ...priceData,
                username: identity?.username || `Token #${priceData.tokenId}`,
                trend: priceData.changePercent > 0 ? 'up' : priceData.changePercent < 0 ? 'down' : 'stable',
                changeAmount: priceData.newPrice - priceData.oldPrice
            };

            // Emit to relevant rooms
            this.io.to(`nft_${priceData.tokenId}`).emit('price_updated', enrichedData);
            this.io.to(`price_${priceData.tokenId}`).emit('price_change', enrichedData);

            if (identity) {
                this.io.to(`address_${identity.ownerAddress}`).emit('portfolio_price_update', enrichedData);
                this.io.to(`portfolio_${identity.ownerAddress}`).emit('price_update', enrichedData);
            }

            this.io.to('marketplace').emit('price_update', enrichedData);
            this.io.to('leaderboard').emit('price_update', enrichedData);

            // Activity feed for significant price changes
            if (Math.abs(priceData.changePercent) > 5) {
                this.io.to('activity_feed').emit('activity_update', {
                    type: 'significant_price_change',
                    ...enrichedData,
                    timestamp: new Date()
                });
            }

            console.log(`📈 Price update broadcasted: Token ${priceData.tokenId} ${priceData.changePercent > 0 ? '+' : ''}${priceData.changePercent.toFixed(2)}%`);
        } catch (error) {
            console.error('Error broadcasting price update:', error);
        }
    }

    // ==================== ACHIEVEMENT & GOAL EVENTS ====================

    // Broadcast achievement unlock with price impact
    async broadcastAchievementUnlock(achievementData: AchievementUnlock & { priceImpact?: number; newPrice?: number }) {
        try {
            const identity = await Identity.findOne({ tokenId: achievementData.tokenId });

            const enrichedData = {
                ...achievementData,
                username: identity?.username || `Token #${achievementData.tokenId}`,
                ownerAddress: identity?.ownerAddress,
                priceImpact: achievementData.priceImpact || 0,
                newPrice: achievementData.newPrice || identity?.currentPrice
            };

            // Emit to relevant rooms
            this.io.to(`user_${achievementData.tokenId}`).emit('achievement_unlocked', enrichedData);
            this.io.to(`nft_${achievementData.tokenId}`).emit('achievement_unlocked', enrichedData);

            if (identity) {
                this.io.to(`address_${identity.ownerAddress}`).emit('achievement_unlocked', enrichedData);
                this.io.to(`portfolio_${identity.ownerAddress}`).emit('achievement_unlocked', enrichedData);
            }

            // Global achievement announcement for significant achievements
            if (achievementData.achievement.points >= 50) {
                this.io.emit('global_achievement', {
                    username: identity?.username,
                    achievement: achievementData.achievement.title,
                    points: achievementData.achievement.points,
                    priceImpact: achievementData.priceImpact,
                    timestamp: new Date()
                });
            }

            this.io.to('activity_feed').emit('activity_update', {
                type: 'achievement_unlocked',
                ...enrichedData,
                timestamp: new Date()
            });

            // Update leaderboard
            this.broadcastLeaderboardUpdate();

            console.log(`🏆 Achievement broadcasted: ${identity?.username} - ${achievementData.achievement.title} (+${achievementData.achievement.points} pts)`);
        } catch (error) {
            console.error('Error broadcasting achievement unlock:', error);
        }
    }

    // Broadcast goal progress update
    async broadcastGoalUpdate(goalData: GoalUpdate) {
        try {
            const identity = await Identity.findOne({ tokenId: goalData.tokenId });
            const goalProgress = await GoalProgress.findOne({
                token_id: goalData.tokenId,
                goal_index: goalData.goalIndex
            });

            const enrichedData = {
                ...goalData,
                username: identity?.username || `Token #${goalData.tokenId}`,
                goalTitle: goalProgress?.title,
                goalDescription: goalProgress?.description,
                progressPercent: goalProgress ? (goalProgress.current_progress / goalProgress.target_value) * 100 : 0
            };

            // Emit to relevant rooms
            this.io.to(`user_${goalData.tokenId}`).emit('goal_updated', enrichedData);
            this.io.to(`nft_${goalData.tokenId}`).emit('goal_updated', enrichedData);

            if (identity) {
                this.io.to(`address_${identity.ownerAddress}`).emit('goal_updated', enrichedData);
            }

            // Special handling for goal completion/failure
            if (goalData.type === 'completed') {
                this.io.to('activity_feed').emit('activity_update', {
                    activityType: 'goal_completed',
                    ...enrichedData,
                    timestamp: new Date()
                });

                // Update leaderboard for goal completion
                this.broadcastLeaderboardUpdate();
            } else if (goalData.type === 'failed') {
                this.io.to('activity_feed').emit('activity_update', {
                    activityType: 'goal_failed',
                    ...enrichedData,
                    timestamp: new Date()
                });
            }

            console.log(`🎯 Goal update broadcasted: Token ${goalData.tokenId} - ${goalData.type}`);
        } catch (error) {
            console.error('Error broadcasting goal update:', error);
        }
    }

    // ==================== REPUTATION & LEADERBOARD UPDATES ====================

    // Update reputation in real-time
    async updateReputation(tokenId: number, newScore: number, reason: string) {
        try {
            const identity = await Identity.findOne({ tokenId });
            if (!identity) return;

            const oldScore = identity.reputationScore;
            identity.reputationScore = newScore;
            identity.lastUpdate = Date.now();
            await identity.save();

            const update: ReputationUpdate = {
                tokenId,
                oldScore,
                newScore,
                reason,
                timestamp: new Date()
            };

            const enrichedUpdate = {
                ...update,
                username: identity.username,
                changeAmount: newScore - oldScore,
                changePercent: oldScore > 0 ? ((newScore - oldScore) / oldScore) * 100 : 0
            };

            // Emit to user's rooms
            this.io.to(`user_${tokenId}`).emit('reputation_updated', enrichedUpdate);
            this.io.to(`nft_${tokenId}`).emit('reputation_updated', enrichedUpdate);
            this.io.to(`address_${identity.ownerAddress}`).emit('reputation_updated', enrichedUpdate);

            // Update leaderboard in real-time
            this.broadcastLeaderboardUpdate();

            console.log(`⭐ Reputation updated: ${identity.username} from ${oldScore} to ${newScore} (${reason})`);
        } catch (error) {
            console.error('Error updating reputation:', error);
        }
    }

    // Broadcast leaderboard updates
    private async broadcastLeaderboardUpdate() {
        try {
            // Get top 20 users for leaderboard
            const topUsers = await Identity.find()
                .sort({ reputationScore: -1, achievementCount: -1 })
                .limit(20)
                .select('tokenId username reputationScore achievementCount skillLevel currentPrice isVerified')
                .lean();

            // Get recent price changes for each user
            const tokenIds = topUsers.map(user => user.tokenId);
            const recentPriceChanges = await PriceHistory.aggregate([
                { $match: { token_id: { $in: tokenIds } } },
                { $sort: { timestamp: -1 } },
                {
                    $group: {
                        _id: '$token_id',
                        latestChange: { $first: '$price_change_percent' },
                        recentPrice: { $first: '$new_price' }
                    }
                }
            ]);

            const priceChangeMap = recentPriceChanges.reduce((map, change) => {
                map[change._id] = {
                    changePercent: change.latestChange,
                    price: change.recentPrice
                };
                return map;
            }, {} as { [tokenId: number]: { changePercent: number; price: number } });

            const enrichedLeaderboard = topUsers.map((user, index) => ({
                ...user,
                rank: index + 1,
                priceChange: priceChangeMap[user.tokenId]?.changePercent || 0,
                trend: (priceChangeMap[user.tokenId]?.changePercent || 0) > 0 ? 'up' :
                    (priceChangeMap[user.tokenId]?.changePercent || 0) < 0 ? 'down' : 'stable'
            }));

            this.io.to('leaderboard').emit('leaderboard_updated', enrichedLeaderboard);

            // Also emit top 5 to activity feed
            this.io.to('activity_feed').emit('leaderboard_top5', enrichedLeaderboard.slice(0, 5));

        } catch (error) {
            console.error('Error broadcasting leaderboard:', error);
        }
    }

    // ==================== ACTIVITY FEED & ANALYTICS ====================

    // Broadcast live activity
    async broadcastActivity(activity: {
        type: 'achievement' | 'reputation' | 'identity_created' | 'goal_completed' | 'nft_purchase' | 'price_change';
        tokenId: number;
        username: string;
        data: any;
        timestamp: Date;
    }) {
        this.io.to('activity_feed').emit('live_activity', activity);
    }

    // Real-time analytics
    async getRealtimeStats() {
        try {
            const [
                totalUsers,
                totalAchievements,
                avgReputation,
                recentTransactions,
                recentActivities
            ] = await Promise.all([
                Identity.countDocuments(),
                AchievementHistory.countDocuments(),
                Identity.aggregate([
                    { $group: { _id: null, avg: { $avg: '$reputationScore' } } }
                ]),
                NFTTransfer.find()
                    .sort({ timestamp: -1 })
                    .limit(10)
                    .populate('token_id')
                    .lean(),
                AchievementHistory.find()
                    .sort({ timestamp: -1 })
                    .limit(10)
                    .lean()
            ]);

            const stats = {
                totalUsers,
                totalAchievements,
                avgReputation: avgReputation[0]?.avg || 0,
                activeUsers: this.connectedUsers.size,
                connectedRooms: this.roomSubscriptions.size,
                recentTransactions,
                recentActivities,
                timestamp: new Date()
            };

            // Emit to subscribers
            this.io.to('activity_feed').emit('realtime_stats', stats);

            return stats;
        } catch (error) {
            console.error('Error getting realtime stats:', error);
            return null;
        }
    }

    // ==================== PERIODIC UPDATES ====================

    private startPeriodicUpdates() {
        // Update leaderboard every 5 minutes
        setInterval(async () => {
            await this.broadcastLeaderboardUpdate();
        }, 5 * 60 * 1000);

        // Send realtime stats every 30 seconds
        setInterval(async () => {
            await this.getRealtimeStats();
        }, 30 * 1000);

        // Portfolio value updates every 2 minutes
        setInterval(async () => {
            await this.broadcastPortfolioUpdates();
        }, 2 * 60 * 1000);

        console.log('✅ Periodic updates started for realtime service');
    }

    // Broadcast portfolio value updates
    private async broadcastPortfolioUpdates() {
        try {
            // Get all unique addresses from connected users
            const addresses = Array.from(this.connectedUsers.values())
                .map(user => user.address)
                .filter(Boolean) as string[];

            if (addresses.length === 0) return;

            // Get portfolio values for each address
            for (const address of addresses) {
                const transfers = await NFTTransfer.find({
                    to_address: address.toLowerCase()
                }).lean();

                if (transfers.length === 0) continue;

                const tokenIds = transfers.map(t => t.token_id);
                const identities = await Identity.find({
                    tokenId: { $in: tokenIds }
                }).lean();

                const totalValue = identities.reduce((sum, id) => sum + id.currentPrice, 0);
                const totalInvested = transfers.reduce((sum, t) => sum + t.price, 0);
                const totalPnL = totalValue - totalInvested;
                const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

                // Emit portfolio update
                this.io.to(`portfolio_${address}`).emit('portfolio_value_update', {
                    address,
                    totalValue,
                    totalInvested,
                    totalPnL,
                    totalPnLPercent,
                    assetCount: identities.length,
                    timestamp: new Date()
                });
            }
        } catch (error) {
            console.error('Error broadcasting portfolio updates:', error);
        }
    }

    // ==================== PUBLIC METHODS FOR EXTERNAL USE ====================

    // Get connection stats
    getConnectionStats() {
        return {
            connectedUsers: this.connectedUsers.size,
            activeRooms: this.roomSubscriptions.size,
            roomDetails: Array.from(this.roomSubscriptions.entries()).map(([room, sockets]) => ({
                room,
                subscribers: sockets.size
            }))
        };
    }

    // Force refresh for all connected clients
    forceRefreshAll() {
        this.io.emit('force_refresh', {
            message: 'Data updated, please refresh',
            timestamp: new Date()
        });
    }

    // Send notification to specific user
    async sendUserNotification(tokenId: number, notification: {
        type: 'info' | 'success' | 'warning' | 'error';
        title: string;
        message: string;
        action?: { label: string; url: string };
    }) {
        this.io.to(`user_${tokenId}`).emit('notification', {
            ...notification,
            timestamp: new Date()
        });
    }
}

export default RealtimeService;