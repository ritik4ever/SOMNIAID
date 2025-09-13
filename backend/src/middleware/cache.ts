import { Request, Response, NextFunction } from 'express';

interface CacheOptions {
    ttl: number; // Time to live in seconds
    key?: (req: Request) => string;
}

const cache = new Map<string, { data: any; expiry: number }>();

export const cacheMiddleware = (options: CacheOptions) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const key = options.key ? options.key(req) : req.originalUrl;
        const cached = cache.get(key);

        if (cached && Date.now() < cached.expiry) {
            res.json(cached.data);
            return;
        }

        // Override res.json to cache the response
        const originalJson = res.json;
        res.json = function (data: any) {
            if (res.statusCode === 200) {
                cache.set(key, {
                    data,
                    expiry: Date.now() + (options.ttl * 1000)
                });
            }
            return originalJson.call(this, data);
        };

        next();
    };
};

// Clean expired cache entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
        if (now >= value.expiry) {
            cache.delete(key);
        }
    }
}, 5 * 60 * 1000); // Clean every 5 minutes

export const clearCache = (pattern?: string): void => {
    if (pattern) {
        for (const key of cache.keys()) {
            if (key.includes(pattern)) {
                cache.delete(key);
            }
        }
    } else {
        cache.clear();
    }
};