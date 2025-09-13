import compression from 'compression';
import { Request, Response, NextFunction } from 'express';

// Response compression middleware
export const compressionMiddleware = compression({
    level: 6,
    threshold: 1000,
    filter: (req: Request, res: Response) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
});

// Database query optimization utilities
export class QueryOptimizer {
    static paginateQuery(query: any, page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit;
        return query.skip(skip).limit(Math.min(limit, 100)); // Max 100 items per page
    }

    static selectFields(query: any, fields: string[]) {
        return query.select(fields.join(' '));
    }

    static addIndexes(model: any) {
        // Add common indexes for better performance
        model.collection.createIndex({ address: 1 });
        model.collection.createIndex({ tokenId: 1 });
        model.collection.createIndex({ username: 1 });
        model.collection.createIndex({ 'reputation.score': -1 });
        model.collection.createIndex({ createdAt: -1 });
        model.collection.createIndex({ lastActive: -1 });
    }
}

// API response optimization
export const optimizeResponse = (req: Request, res: Response, next: NextFunction) => {
    // Add cache headers for static content
    if (req.url.includes('/api/achievements/available')) {
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
    }

    // Add ETag for identity data
    if (req.url.includes('/api/identity/')) {
        const originalSend = res.send;
        res.send = function (data: any) {
            if (typeof data === 'string') {
                const etag = require('crypto').createHash('md5').update(data).digest('hex');
                res.setHeader('ETag', `"${etag}"`);

                if (req.headers['if-none-match'] === `"${etag}"`) {
                    res.status(304);
                    return res.end();
                }
            }
            return originalSend.call(this, data);
        };
    }

    next();
};