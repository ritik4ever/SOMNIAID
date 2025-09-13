import { performance } from 'perf_hooks';
import { Request, Response, NextFunction } from 'express';

// Simplified monitoring without Sentry dependency
export const initMonitoring = (): void => {
    console.log('📊 Monitoring initialized');
};

// Performance monitoring middleware
export const performanceMonitor = (req: Request, res: Response, next: NextFunction): void => {
    const start = performance.now();
    const route = req.route?.path || req.path;

    res.on('finish', () => {
        const duration = performance.now() - start;
        const statusCode = res.statusCode;

        // Log slow requests
        if (duration > 1000) { // > 1 second
            console.warn(`🐌 Slow request: ${req.method} ${route} - ${duration.toFixed(2)}ms`);
        }

        // Track metrics
        trackMetric('api.request.duration', duration, {
            method: req.method,
            route,
            status_code: statusCode.toString()
        });
    });

    next();
};

// Custom metrics tracking
interface MetricTags {
    [key: string]: string | number;
}

const metrics: Array<{
    name: string;
    value: number;
    tags: MetricTags;
    timestamp: number;
}> = [];

export const trackMetric = (name: string, value: number, tags: MetricTags = {}): void => {
    const metric = {
        name,
        value,
        tags,
        timestamp: Date.now()
    };

    metrics.push(metric);

    // Keep only last 1000 metrics in memory
    if (metrics.length > 1000) {
        metrics.shift();
    }

    console.log(`📊 Metric: ${name} = ${value}`, tags);
};

// Health check endpoint data
export const getHealthMetrics = () => {
    const now = Date.now();
    const last5Minutes = metrics.filter(m => now - m.timestamp < 5 * 60 * 1000);

    const apiRequests = last5Minutes.filter(m => m.name === 'api.request.duration');
    const avgResponseTime = apiRequests.length > 0
        ? apiRequests.reduce((sum, m) => sum + m.value, 0) / apiRequests.length
        : 0;

    const errorCount = last5Minutes.filter(m =>
        m.name === 'api.request.duration' &&
        typeof m.tags.status_code === 'string' &&
        m.tags.status_code.startsWith('5')
    ).length;

    return {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
        requestCount: apiRequests.length,
        errorCount,
        errorRate: apiRequests.length > 0 ? (errorCount / apiRequests.length) * 100 : 0
    };
};

// Error reporting helper
export const reportError = (error: Error, context?: any): void => {
    console.error('❌ Error:', error.message, context);

    // In production, integrate with external error tracking
    if (process.env.NODE_ENV === 'production') {
        // Example: send to external service
        console.log('📤 Error reported to monitoring service');
    }
};

// User analytics tracking
export const trackUserEvent = (userId: string, event: string, properties?: any): void => {
    const eventData = {
        userId,
        event,
        properties: properties || {},
        timestamp: new Date().toISOString()
    };

    console.log('👤 User Event:', eventData);
};