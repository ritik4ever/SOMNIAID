import { Request, Response, NextFunction } from 'express';

interface AnalyticsEvent {
    name: string;
    properties?: Record<string, any>;
    userId?: string;
    timestamp?: string;
    userAgent?: string;
    ip?: string;
}

class BackendAnalytics {
    private isProduction = process.env.NODE_ENV === 'production';

    init() {
        if (this.isProduction) {
            // Initialize backend analytics services
            console.log('🔍 Analytics initialized for production');
        }
    }

    track(event: AnalyticsEvent) {
        const eventData = {
            ...event,
            timestamp: event.timestamp || new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development'
        };

        // Console log in development
        if (!this.isProduction) {
            console.log('📊 Backend Analytics Event:', eventData);
            return;
        }

        try {
            // Send to external analytics services in production
            this.sendToAnalyticsAPI(eventData);
        } catch (error) {
            console.error('Analytics tracking error:', error);
        }
    }

    private async sendToAnalyticsAPI(eventData: AnalyticsEvent) {
        // Implementation for external analytics API
        try {
            // Example implementation for production analytics
            if (process.env.ANALYTICS_API_URL && process.env.ANALYTICS_API_KEY) {
                const response = await fetch(process.env.ANALYTICS_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.ANALYTICS_API_KEY}`
                    },
                    body: JSON.stringify(eventData)
                });

                if (!response.ok) {
                    throw new Error(`Analytics API error: ${response.status}`);
                }

                console.log('📊 Sent to analytics API:', eventData.name);
            } else {
                // Fallback: log to console in production if no external service configured
                console.log('📊 Analytics (no external service):', eventData.name);
            }
        } catch (error) {
            console.error('Failed to send analytics:', error);
        }
    }

    // Specific tracking methods for backend events
    trackAPIRequest(req: Request, duration: number, statusCode: number) {
        this.track({
            name: 'api_request',
            properties: {
                method: req.method,
                path: req.path,
                duration,
                statusCode,
                userAgent: req.headers['user-agent'],
                ip: req.ip
            }
        });
    }

    trackUserSignup(userId: string, address: string) {
        this.track({
            name: 'user_signup',
            userId,
            properties: { address }
        });
    }

    trackIdentityCreated(userId: string, tokenId: number) {
        this.track({
            name: 'identity_created',
            userId,
            properties: { tokenId }
        });
    }

    trackReputationUpdate(userId: string, tokenId: number, oldScore: number, newScore: number) {
        this.track({
            name: 'reputation_updated',
            userId,
            properties: {
                tokenId,
                oldScore,
                newScore,
                increase: newScore - oldScore
            }
        });
    }

    trackAchievementUnlocked(userId: string, tokenId: number, achievementTitle: string, points: number) {
        this.track({
            name: 'achievement_unlocked',
            userId,
            properties: {
                tokenId,
                achievementTitle,
                points
            }
        });
    }

    trackWalletConnected(userId: string, address: string) {
        this.track({
            name: 'wallet_connected',
            userId,
            properties: { address }
        });
    }

    trackError(error: string, context?: any, userId?: string) {
        this.track({
            name: 'backend_error',
            userId,
            properties: { error, context }
        });
    }

    trackSearch(userId: string, query: string, resultsCount: number) {
        this.track({
            name: 'search_performed',
            userId,
            properties: {
                query,
                resultsCount
            }
        });
    }

    trackLeaderboardView(userId?: string, page?: number) {
        this.track({
            name: 'leaderboard_viewed',
            userId,
            properties: { page: page || 1 }
        });
    }
}

export const analytics = new BackendAnalytics();

// Middleware for automatic request tracking
export const analyticsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        analytics.trackAPIRequest(req, duration, res.statusCode);
    });

    next();
};

// Helper function to track user events in routes
export const trackUserEvent = (eventName: string, userId: string, properties?: any) => {
    analytics.track({
        name: eventName,
        userId,
        properties
    });
};