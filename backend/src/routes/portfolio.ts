import express, { Request, Response } from 'express';
import Identity from '../models/Identity';
import NFTTransfer from '../models/NFTTransfer';
import PriceHistory from '../models/PriceHistory';
import AchievementHistory from '../models/AchievementHistory';
import BlockchainSyncService from '../services/blockchain-sync';

const router = express.Router();

// ==================== PORTFOLIO ANALYTICS ROUTES ====================

// Get comprehensive portfolio data for an address
router.get('/:address', async (req: Request, res: Response): Promise<void> => {
    try {
        const { address } = req.params;
        const includeHistory = req.query.includeHistory === 'true';

        console.log(`📊 Fetching comprehensive portfolio for: ${address}`);

        // Get portfolio data from blockchain sync service
        const portfolioData = await BlockchainSyncService.getPortfolioData(address);

        if (!portfolioData || portfolioData.portfolioIdentities.length === 0) {
            res.json({
                success: true,
                ownedNFTs: [],
                totalValue: 0,
                totalInvested: 0,
                totalPnL: 0,
                analytics: {
                    totalTransactions: 0,
                    averageHoldingPeriod: 0,
                    bestPerformer: null,
                    worstPerformer: null,
                    totalAchievements: 0
                },
                portfolio: []
            });
            return;
        }

        // FIXED: Use correct property names from getPortfolioData()
        const { portfolioNFTs, portfolioIdentities, totalPortfolioValue } = portfolioData;

        // Calculate detailed analytics
        const portfolioItems = portfolioIdentities.map((identity: any) => {
            const purchaseData = portfolioNFTs.find((t: any) => t.token_id === identity.tokenId);
            const priceChange = identity.currentPrice - (purchaseData?.price || identity.currentPrice);
            const priceChangePercent = purchaseData?.price
                ? ((identity.currentPrice - purchaseData.price) / purchaseData.price) * 100
                : 0;

            return {
                tokenId: identity.tokenId,
                username: identity.username,
                primarySkill: identity.primarySkill,
                reputationScore: identity.reputationScore,
                skillLevel: identity.skillLevel,
                achievementCount: identity.achievementCount,
                currentPrice: identity.currentPrice,
                purchasePrice: purchaseData?.price || identity.currentPrice,
                purchaseDate: purchaseData?.timestamp || identity.createdAt,
                holdingPeriod: purchaseData ? Math.floor((Date.now() - new Date(purchaseData.timestamp).getTime()) / (1000 * 60 * 60 * 24)) : 0,
                priceChange,
                priceChangePercent,
                isVerified: identity.isVerified,
                ownerAddress: identity.ownerAddress,
                performance: priceChangePercent > 10 ? 'excellent' : priceChangePercent > 0 ? 'good' : priceChangePercent > -10 ? 'fair' : 'poor'
            };
        });

        // Calculate portfolio totals - FIXED: Added explicit types
        const totalCurrentValue = portfolioItems.reduce((sum: number, item: any) => sum + item.currentPrice, 0);
        const totalInvestedValue = portfolioItems.reduce((sum: number, item: any) => sum + item.purchasePrice, 0);
        const totalPnL = totalCurrentValue - totalInvestedValue;
        const totalPnLPercent = totalInvestedValue > 0 ? (totalPnL / totalInvestedValue) * 100 : 0;

        // Portfolio analytics - FIXED: Added explicit types
        const analytics = {
            totalTransactions: portfolioNFTs.length,
            averageHoldingPeriod: portfolioItems.length > 0
                ? portfolioItems.reduce((sum: number, item: any) => sum + item.holdingPeriod, 0) / portfolioItems.length
                : 0,
            bestPerformer: portfolioItems.length > 0
                ? portfolioItems.reduce((best: any, item: any) => item.priceChangePercent > best.priceChangePercent ? item : best)
                : null,
            worstPerformer: portfolioItems.length > 0
                ? portfolioItems.reduce((worst: any, item: any) => item.priceChangePercent < worst.priceChangePercent ? item : worst)
                : null,
            totalAchievements: portfolioItems.reduce((sum: number, item: any) => sum + item.achievementCount, 0),
            averageReputationScore: portfolioItems.length > 0
                ? portfolioItems.reduce((sum: number, item: any) => sum + item.reputationScore, 0) / portfolioItems.length
                : 0,
            portfolioPerformance: totalPnLPercent > 10 ? 'excellent' : totalPnLPercent > 0 ? 'good' : totalPnLPercent > -10 ? 'fair' : 'poor',
            diversification: {
                skillTypes: [...new Set(portfolioItems.map((item: any) => item.primarySkill))].length,
                skillDistribution: portfolioItems.reduce((dist: { [key: string]: number }, item: any) => {
                    dist[item.primarySkill] = (dist[item.primarySkill] || 0) + 1;
                    return dist;
                }, {} as { [key: string]: number })
            }
        };

        // Include historical data if requested
        let historicalData = {};
        if (includeHistory) {
            const tokenIds = portfolioItems.map((item: any) => item.tokenId);

            const [priceHistories, achievementHistories] = await Promise.all([
                PriceHistory.find({ token_id: { $in: tokenIds } })
                    .sort({ timestamp: -1 })
                    .limit(100)
                    .lean(),
                AchievementHistory.find({ token_id: { $in: tokenIds } })
                    .sort({ timestamp: -1 })
                    .lean()
            ]);

            historicalData = {
                priceHistories,
                achievementHistories,
                portfolioValueOverTime: await calculatePortfolioValueOverTime(tokenIds)
            };
        }

        res.json({
            success: true,
            ownedNFTs: portfolioItems,
            totalValue: totalCurrentValue,
            totalInvested: totalInvestedValue,
            totalPnL,
            totalPnLPercent,
            analytics,
            ...(includeHistory && { history: historicalData }),
            portfolio: portfolioItems, // For compatibility
            metadata: {
                fetchedAt: new Date(),
                address,
                portfolioSize: portfolioItems.length
            }
        });

    } catch (error) {
        console.error('Error fetching portfolio:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch portfolio data'
        });
    }
});

// Get portfolio performance summary
router.get('/:address/performance', async (req: Request, res: Response): Promise<void> => {
    try {
        const { address } = req.params;
        const period = parseInt(req.query.period as string) || 30; // days

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - period);

        // Get transfers within period
        const recentTransfers = await NFTTransfer.find({
            to_address: address.toLowerCase(),
            timestamp: { $gte: cutoffDate }
        }).lean();

        if (recentTransfers.length === 0) {
            res.json({
                success: true,
                performance: {
                    period,
                    transactions: 0,
                    totalInvested: 0,
                    currentValue: 0,
                    unrealizedGains: 0,
                    realizedGains: 0,
                    totalReturn: 0,
                    roi: 0
                }
            });
            return;
        }

        const tokenIds = recentTransfers.map(t => t.token_id);
        const currentIdentities = await Identity.find({
            tokenId: { $in: tokenIds }
        }).lean();

        // Calculate performance metrics
        const totalInvested = recentTransfers.reduce((sum, t) => sum + t.price, 0);
        const currentValue = currentIdentities.reduce((sum, id) => sum + id.currentPrice, 0);
        const unrealizedGains = currentValue - totalInvested;

        // Get realized gains from sales (if any)
        const soldTransfers = await NFTTransfer.find({
            from_address: address.toLowerCase(),
            timestamp: { $gte: cutoffDate },
            transfer_type: 'sale'
        }).lean();

        const realizedGains = soldTransfers.reduce((gains, sale) => {
            const purchase = recentTransfers.find(p => p.token_id === sale.token_id);
            return purchase ? gains + (sale.price - purchase.price) : gains;
        }, 0);

        const totalReturn = unrealizedGains + realizedGains;
        const roi = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

        res.json({
            success: true,
            performance: {
                period,
                transactions: recentTransfers.length,
                totalInvested,
                currentValue,
                unrealizedGains,
                realizedGains,
                totalReturn,
                roi,
                performanceRating: roi > 20 ? 'excellent' : roi > 10 ? 'good' : roi > 0 ? 'fair' : 'poor'
            }
        });

    } catch (error) {
        console.error('Error calculating portfolio performance:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to calculate portfolio performance'
        });
    }
});

// Get portfolio diversification analysis
router.get('/:address/diversification', async (req: Request, res: Response): Promise<void> => {
    try {
        const { address } = req.params;

        const transfers = await NFTTransfer.find({
            to_address: address.toLowerCase()
        }).lean();

        if (transfers.length === 0) {
            res.json({
                success: true,
                diversification: {
                    totalAssets: 0,
                    skillDiversification: {},
                    priceRangeDistribution: {},
                    diversificationScore: 0,
                    recommendations: []
                }
            });
            return;
        }

        const tokenIds = transfers.map(t => t.token_id);
        const identities = await Identity.find({
            tokenId: { $in: tokenIds }
        }).lean();

        // Skill diversification
        const skillDistribution = identities.reduce((dist, id) => {
            dist[id.primarySkill] = (dist[id.primarySkill] || 0) + 1;
            return dist;
        }, {} as { [key: string]: number });

        // Price range distribution
        const priceRanges = ['0-10', '10-50', '50-100', '100+'];
        const priceDistribution = identities.reduce((dist, id) => {
            const price = id.currentPrice;
            const range = price <= 10 ? '0-10' : price <= 50 ? '10-50' : price <= 100 ? '50-100' : '100+';
            dist[range] = (dist[range] || 0) + 1;
            return dist;
        }, {} as { [key: string]: number });

        // Calculate diversification score (0-100)
        const skillCount = Object.keys(skillDistribution).length;
        const maxSkillConcentration = Math.max(...Object.values(skillDistribution)) / identities.length;
        const diversificationScore = Math.min(100, (skillCount * 20) + ((1 - maxSkillConcentration) * 80));

        // Generate recommendations
        const recommendations = [];
        if (skillCount < 3) {
            recommendations.push('Consider diversifying across more skill categories');
        }
        if (maxSkillConcentration > 0.7) {
            recommendations.push('Portfolio is heavily concentrated in one skill area');
        }
        if (identities.length < 5) {
            recommendations.push('Consider increasing portfolio size for better diversification');
        }

        res.json({
            success: true,
            diversification: {
                totalAssets: identities.length,
                skillDiversification: skillDistribution,
                priceRangeDistribution: priceDistribution,
                diversificationScore: Math.round(diversificationScore),
                maxConcentration: Math.round(maxSkillConcentration * 100),
                recommendations
            }
        });

    } catch (error) {
        console.error('Error analyzing portfolio diversification:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze portfolio diversification'
        });
    }
});

// Get portfolio transaction history
router.get('/:address/transactions', async (req: Request, res: Response): Promise<void> => {
    try {
        const { address } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const type = req.query.type as string; // 'buy', 'sell', 'all'
        const skip = (page - 1) * limit;

        let filter: any = {
            $or: [
                { to_address: address.toLowerCase() },
                { from_address: address.toLowerCase() }
            ]
        };

        if (type === 'buy') {
            filter = { to_address: address.toLowerCase() };
        } else if (type === 'sell') {
            filter = { from_address: address.toLowerCase() };
        }

        const transactions = await NFTTransfer.find(filter)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await NFTTransfer.countDocuments(filter);

        // Enrich with identity data
        const tokenIds = transactions.map(t => t.token_id);
        const identities = await Identity.find({
            tokenId: { $in: tokenIds }
        }).select('tokenId username primarySkill currentPrice')
            .lean();

        const identityMap = identities.reduce((map, id) => {
            map[id.tokenId] = id;
            return map;
        }, {} as { [key: number]: any });

        const enrichedTransactions = transactions.map(tx => ({
            ...tx,
            identity: identityMap[tx.token_id],
            transactionType: tx.to_address.toLowerCase() === address.toLowerCase() ? 'purchase' : 'sale',
            currentValue: identityMap[tx.token_id]?.currentPrice || 0,
            priceChange: identityMap[tx.token_id] ? identityMap[tx.token_id].currentPrice - tx.price : 0
        }));

        res.json({
            success: true,
            transactions: enrichedTransactions,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Error fetching transaction history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch transaction history'
        });
    }
});

// ==================== HELPER FUNCTIONS ====================

async function calculatePortfolioValueOverTime(tokenIds: number[]) {
    try {
        // Get price history for the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const priceHistory = await PriceHistory.find({
            token_id: { $in: tokenIds },
            timestamp: { $gte: thirtyDaysAgo }
        }).sort({ timestamp: 1 }).lean();

        // Group by date and calculate total portfolio value
        const valueByDate = priceHistory.reduce((acc, entry) => {
            const date = entry.timestamp.toISOString().split('T')[0];
            if (!acc[date]) {
                acc[date] = {};
            }
            acc[date][entry.token_id] = entry.new_price;
            return acc;
        }, {} as { [date: string]: { [tokenId: number]: number } });

        // Calculate portfolio value for each date
        const portfolioValueOverTime = Object.entries(valueByDate).map(([date, prices]) => {
            const totalValue = Object.values(prices).reduce((sum, price) => sum + price, 0);
            return {
                date,
                totalValue,
                tokenCount: Object.keys(prices).length
            };
        });

        return portfolioValueOverTime;
    } catch (error) {
        console.error('Error calculating portfolio value over time:', error);
        return [];
    }
}

export default router;