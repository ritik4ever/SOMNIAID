import { Server } from 'socket.io';
import Identity from '../models/Identity';

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
    };
    timestamp: Date;
}

class RealtimeService {
    private io: Server;
    private connectedUsers: Map<string, { socketId: string; tokenId?: number }> = new Map();

    constructor(io: Server) {
        this.io = io;
        this.setupEventHandlers();
    }

    private setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`User connected: ${socket.id}`);

            socket.on('join_user', (tokenId: number) => {
                this.connectedUsers.set(socket.id, { socketId: socket.id, tokenId });
                socket.join(`user_${tokenId}`);
                console.log(`User ${tokenId} joined room`);
            });

            socket.on('disconnect', () => {
                this.connectedUsers.delete(socket.id);
                console.log(`User disconnected: ${socket.id}`);
            });

            // Real-time reputation tracking
            socket.on('track_reputation', (tokenId: number) => {
                socket.join(`reputation_${tokenId}`);
            });

            // Real-time leaderboard updates
            socket.on('track_leaderboard', () => {
                socket.join('leaderboard');
            });
        });
    }

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

            // Emit to user's room
            this.io.to(`user_${tokenId}`).emit('reputation_updated', update);

            // Emit to reputation trackers
            this.io.to(`reputation_${tokenId}`).emit('reputation_changed', update);

            // Update leaderboard in real-time
            this.broadcastLeaderboardUpdate();

            console.log(`Reputation updated: ${tokenId} from ${oldScore} to ${newScore} (${reason})`);
        } catch (error) {
            console.error('Error updating reputation:', error);
        }
    }

    // Unlock achievement with real-time notification
    async unlockAchievement(tokenId: number, achievementData: any) {
        try {
            const identity = await Identity.findOne({ tokenId });
            if (!identity) return;

            // Add achievement to profile
            const achievement = {
                id: `ach_${Date.now()}`,
                ...achievementData,
                verified: false,
                dateAchieved: new Date()
            };

            identity.profile.achievements.push(achievement);
            identity.achievementCount = identity.profile.achievements.length;
            identity.reputationScore += achievementData.points || 10;
            identity.lastUpdate = Date.now();

            await identity.save();

            const unlock: AchievementUnlock = {
                tokenId,
                achievement,
                timestamp: new Date()
            };

            // Real-time achievement notification
            this.io.to(`user_${tokenId}`).emit('achievement_unlocked', unlock);

            // Global achievement announcement
            this.io.emit('global_achievement', {
                username: identity.username,
                achievement: achievement.title,
                timestamp: new Date()
            });

            // Update leaderboard
            this.broadcastLeaderboardUpdate();

            console.log(`Achievement unlocked: ${identity.username} - ${achievement.title}`);
        } catch (error) {
            console.error('Error unlocking achievement:', error);
        }
    }

    // Broadcast leaderboard updates
    private async broadcastLeaderboardUpdate() {
        try {
            const topUsers = await Identity.find()
                .sort({ reputationScore: -1 })
                .limit(10)
                .select('tokenId username reputationScore achievementCount skillLevel currentPrice')
                .lean();

            this.io.to('leaderboard').emit('leaderboard_updated', topUsers);
        } catch (error) {
            console.error('Error broadcasting leaderboard:', error);
        }
    }

    // Live activity feed
    async broadcastActivity(activity: {
        type: 'achievement' | 'reputation' | 'identity_created' | 'goal_completed';
        tokenId: number;
        username: string;
        data: any;
        timestamp: Date;
    }) {
        this.io.emit('live_activity', activity);
    }

    // Real-time analytics
    async getRealtimeStats() {
        const stats = {
            totalUsers: await Identity.countDocuments(),
            totalAchievements: await Identity.aggregate([
                { $project: { achievementCount: { $size: '$profile.achievements' } } },
                { $group: { _id: null, total: { $sum: '$achievementCount' } } }
            ]),
            avgReputation: await Identity.aggregate([
                { $group: { _id: null, avg: { $avg: '$reputationScore' } } }
            ]),
            activeUsers: this.connectedUsers.size,
            recentActivities: await Identity.find()
                .sort({ lastUpdate: -1 })
                .limit(10)
                .select('username lastUpdate')
                .lean()
        };

        this.io.emit('realtime_stats', stats);
        return stats;
    }
}

export default RealtimeService;