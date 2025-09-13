import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

// Rate limiting configurations
export const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

export const apiRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests, please try again later',
    skip: (req: Request) => {
        // Skip rate limiting for authenticated users with higher limits
        return req.headers.authorization !== undefined;
    }
});

export const createIdentityRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 identity creations per hour per IP
    message: 'Too many identity creation attempts, please try again later',
});

// Security headers
export const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
            fontSrc: ["'self'", "fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'", "wss:", "https://dream-rpc.somnia.network"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false,
});

// Input sanitization
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
    const sanitize = (obj: any): any => {
        if (typeof obj === 'string') {
            return obj
                .trim()
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
        }

        if (Array.isArray(obj)) {
            return obj.map(sanitize);
        }

        if (obj && typeof obj === 'object') {
            const sanitized: any = {};
            for (const [key, value] of Object.entries(obj)) {
                sanitized[key] = sanitize(value);
            }
            return sanitized;
        }

        return obj;
    };

    if (req.body) {
        req.body = sanitize(req.body);
    }

    if (req.query) {
        req.query = sanitize(req.query);
    }

    next();
};

// API key validation (for admin endpoints)
export const validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = req.headers['x-api-key'];
    const validApiKey = process.env.ADMIN_API_KEY;

    if (!validApiKey) {
        res.status(500).json({ error: 'API key not configured' });
        return;
    }

    if (!apiKey || apiKey !== validApiKey) {
        res.status(401).json({ error: 'Invalid API key' });
        return;
    }

    next();
};

// Request size limiting
export const limitRequestSize = (maxSize: string = '10mb') => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const contentLength = req.headers['content-length'];
        const maxBytes = parseSize(maxSize);

        if (contentLength && parseInt(contentLength) > maxBytes) {
            res.status(413).json({ error: 'Request too large' });
            return;
        }

        next();
    };
};

function parseSize(size: string): number {
    const units: { [key: string]: number } = {
        b: 1,
        kb: 1024,
        mb: 1024 * 1024,
        gb: 1024 * 1024 * 1024
    };

    const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([kmg]?b)$/);
    if (!match) return 1024 * 1024; // Default 1MB

    return parseFloat(match[1]) * (units[match[2]] || 1);
}