import express, { Request, Response } from 'express';
import Identity from '../models/Identity';
import NFTTransfer from '../models/NFTTransfer';
import MarketplaceListing from '../models/MarketplaceListing';
import PriceHistory from '../models/PriceHistory';
import BlockchainSyncService, { CONTRACT_ADDRESS, CONTRACT_ABI, publicClient } from '../services/blockchain-sync';

import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';



//  MARKETPLACE LISTINGS 

const router = express.Router();

// FIXED: Get all marketplace listings
router.get('/listings', async (req: Request, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const sortBy = req.query.sortBy as string || 'price';
        const sortOrder = req.query.sortOrder as string || 'asc';
        const skip = (page - 1) * limit;

        console.log('📊 Getting marketplace listings...');

        // Build filter
        let filter: any = { isActive: true };

        // Get active listings from database
        let dbListings = await MarketplaceListing.find(filter)
            .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        console.log(`Found ${dbListings.length} database listings`);

        // CRITICAL FIX: Always check blockchain for current listings
        let blockchainListings: any[] = [];

        try {
            // Get listed identities directly from contract
            const totalIdentities = await publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getTotalIdentities'
            }) as bigint;

            console.log(`Total identities on chain: ${totalIdentities}`);

            // Check each token to see if it's listed
            for (let i = 0; i < Number(totalIdentities); i++) {
                try {
                    const listingInfo = await publicClient.readContract({
                        address: CONTRACT_ADDRESS,
                        abi: CONTRACT_ABI,
                        functionName: 'getListingInfo',
                        args: [BigInt(i)]
                    }) as [boolean, bigint];

                    if (listingInfo[0]) { // isListed = true
                        console.log(`Token ${i} is listed for ${listingInfo[1]} wei`);

                        // Get identity data from blockchain
                        const identity = await publicClient.readContract({
                            address: CONTRACT_ADDRESS,
                            abi: CONTRACT_ABI,
                            functionName: 'getIdentity',
                            args: [BigInt(i)]
                        }) as any;

                        // Get owner
                        const owner = await publicClient.readContract({
                            address: CONTRACT_ADDRESS,
                            abi: CONTRACT_ABI,
                            functionName: 'ownerOf',
                            args: [BigInt(i)]
                        }) as string;

                        // Get username from database if available
                        const dbIdentity = await Identity.findOne({ tokenId: i });
                        const username = dbIdentity?.username || `Identity #${i}`;

                        blockchainListings.push({
                            tokenId: i,
                            username: username,
                            primarySkill: identity.primarySkill || 'Blockchain Developer',
                            reputationScore: Number(identity.reputationScore || 100),
                            skillLevel: Number(identity.skillLevel || 1),
                            achievementCount: Number(identity.achievementCount || 0),
                            currentPrice: listingInfo[1].toString(), // Keep as string to avoid precision loss
                            isVerified: identity.isVerified || false,
                            seller: owner.toLowerCase(),
                            isActive: true,
                            listedAt: new Date()
                        });
                    }
                } catch (tokenError) {
                    // Token doesn't exist or other error, continue
                    continue;
                }
            }

            console.log(`Found ${blockchainListings.length} blockchain listings`);

        } catch (blockchainError) {
            console.error('Blockchain query failed:', blockchainError);
        }

        // Use blockchain listings as primary source
        let finalListings = blockchainListings;

        // If no blockchain listings but we have DB listings, use those as fallback
        if (blockchainListings.length === 0 && dbListings.length > 0) {
            console.log('Using database listings as fallback');

            const tokenIds = dbListings.map(listing => listing.tokenId);
            const identities = await Identity.find({
                tokenId: { $in: tokenIds }
            }).lean();

            const identityMap = identities.reduce((map, identity) => {
                map[identity.tokenId] = identity;
                return map;
            }, {} as { [key: number]: any });

            finalListings = dbListings.map(listing => {
                const identity = identityMap[listing.tokenId];
                return {
                    ...listing,
                    username: identity?.username || `Identity #${listing.tokenId}`,
                    primarySkill: identity?.primarySkill || 'Unknown',
                    reputationScore: identity?.reputationScore || 100,
                    skillLevel: identity?.skillLevel || 1,
                    achievementCount: identity?.achievementCount || 0,
                    isVerified: identity?.isVerified || false,
                    currentPrice: listing.price?.toString() || '0'
                };
            });
        }

        // Apply sorting to final results
        finalListings.sort((a, b) => {
            const aPrice = Number(a.currentPrice) / 1e18;
            const bPrice = Number(b.currentPrice) / 1e18;

            switch (sortBy) {
                case 'price':
                    return sortOrder === 'asc' ? aPrice - bPrice : bPrice - aPrice;
                case 'reputation':
                    return sortOrder === 'asc' ? a.reputationScore - b.reputationScore : b.reputationScore - a.reputationScore;
                case 'achievements':
                    return sortOrder === 'asc' ? a.achievementCount - b.achievementCount : b.achievementCount - a.achievementCount;
                default:
                    return 0;
            }
        });

        const total = finalListings.length;
        const paginatedListings = finalListings.slice(skip, skip + limit);

        res.json({
            success: true,
            listings: paginatedListings,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Error getting marketplace listings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get marketplace listings',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// List an NFT for sale
router.post('/list', async (req: Request, res: Response): Promise<void> => {
    try {
        const { tokenId, price, sellerAddress } = req.body;

        if (!tokenId || !price || !sellerAddress) {
            res.status(400).json({
                success: false,
                error: 'Token ID, price, and seller address are required'
            });
            return;
        }

        // Verify the identity exists and belongs to seller
        const identity = await Identity.findOne({
            tokenId,
            ownerAddress: sellerAddress.toLowerCase()
        });

        if (!identity) {
            res.status(404).json({
                success: false,
                error: 'Identity not found or you do not own this NFT'
            });
            return;
        }

        // Check if already listed
        const existingListing = await MarketplaceListing.findOne({
            tokenId,
            isActive: true
        });

        if (existingListing) {
            res.status(400).json({
                success: false,
                error: 'NFT is already listed for sale'
            });
            return;
        }

        // Create marketplace listing
        const listing = new MarketplaceListing({
            tokenId,
            sellerAddress: sellerAddress.toLowerCase(),
            price: parseFloat(price),
            isActive: true,
            listedAt: new Date()
        });

        await listing.save();

        console.log(`🏷️ NFT listed: Token #${tokenId} for ${price} ETH by ${sellerAddress}`);

        // Emit real-time event
        if ((req as any).io) {
            (req as any).io.emit('nft_listed', {
                tokenId,
                price,
                seller: sellerAddress,
                identity: {
                    username: identity.username,
                    primarySkill: identity.primarySkill,
                    reputationScore: identity.reputationScore
                }
            });
        }

        res.json({
            success: true,
            listing: {
                ...listing.toObject(),
                identity: {
                    username: identity.username,
                    primarySkill: identity.primarySkill,
                    reputationScore: identity.reputationScore
                }
            },
            message: 'NFT listed successfully'
        });

    } catch (error) {
        console.error('Error listing NFT:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list NFT'
        });
    }
});

// Remove NFT from sale
router.post('/unlist', async (req: Request, res: Response): Promise<void> => {
    try {
        const { tokenId, sellerAddress } = req.body;

        const result = await MarketplaceListing.updateOne(
            {
                tokenId,
                sellerAddress: sellerAddress.toLowerCase(),
                isActive: true
            },
            {
                $set: {
                    isActive: false,
                    unlistedAt: new Date()
                }
            }
        );

        if (result.modifiedCount > 0) {
            res.json({
                success: true,
                message: 'NFT removed from marketplace'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Active listing not found'
            });
        }

    } catch (error) {
        console.error('Error unlisting NFT:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to unlist NFT'
        });
    }
});

// Get specific listing details
router.get('/listing/:tokenId', async (req: Request, res: Response): Promise<void> => {
    try {
        const tokenId = parseInt(req.params.tokenId);

        const listing = await MarketplaceListing.findOne({
            tokenId,
            isActive: true
        }).lean();

        if (!listing) {
            res.json({
                success: true,
                listed: false,
                listing: null
            });
            return;
        }

        // Get identity data
        const identity = await Identity.findOne({ tokenId }).lean();

        res.json({
            success: true,
            listed: true,
            listing: {
                ...listing,
                identity: identity ? {
                    username: identity.username,
                    primarySkill: identity.primarySkill,
                    reputationScore: identity.reputationScore,
                    skillLevel: identity.skillLevel,
                    achievementCount: identity.achievementCount
                } : null
            }
        });

    } catch (error) {
        console.error('Error getting listing:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get listing'
        });
    }
});

// ==================== MARKETPLACE ANALYTICS ====================

// Get marketplace statistics
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
    try {
        const [totalListings, totalSales, avgPrice, recentSales] = await Promise.all([
            MarketplaceListing.countDocuments({ isActive: true }),
            NFTTransfer.countDocuments({ transfer_type: 'sale' }),
            MarketplaceListing.aggregate([
                { $match: { isActive: true } },
                { $group: { _id: null, avgPrice: { $avg: '$price' } } }
            ]),
            NFTTransfer.find({ transfer_type: 'sale' })
                .sort({ timestamp: -1 })
                .limit(10)
                .lean()
        ]);

        // Get volume statistics
        const volumeStats = await NFTTransfer.aggregate([
            { $match: { transfer_type: 'sale' } },
            {
                $group: {
                    _id: null,
                    totalVolume: { $sum: '$price' },
                    avgSalePrice: { $avg: '$price' }
                }
            }
        ]);

        // Get price ranges
        const priceRanges = await MarketplaceListing.aggregate([
            { $match: { isActive: true } },
            {
                $bucket: {
                    groupBy: '$price',
                    boundaries: [0, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0, Infinity],
                    default: 'Other',
                    output: { count: { $sum: 1 } }
                }
            }
        ]);

        res.json({
            success: true,
            stats: {
                totalActiveListings: totalListings,
                totalSales,
                averageListingPrice: avgPrice[0]?.avgPrice || 0,
                totalVolume: volumeStats[0]?.totalVolume || 0,
                averageSalePrice: volumeStats[0]?.avgSalePrice || 0,
                priceDistribution: priceRanges,
                recentSales: recentSales.slice(0, 5) // Top 5 recent sales
            }
        });

    } catch (error) {
        console.error('Error getting marketplace stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get marketplace statistics'
        });
    }
});

// Get trending NFTs (most viewed, recent price changes)
router.get('/trending', async (req: Request, res: Response): Promise<void> => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;

        // Get NFTs with recent price increases
        const trending = await PriceHistory.aggregate([
            {
                $match: {
                    timestamp: {
                        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                    }
                }
            },
            {
                $group: {
                    _id: '$token_id',
                    totalPriceChange: { $sum: { $subtract: ['$new_price', '$old_price'] } },
                    priceChangePercent: { $avg: '$price_change_percent' },
                    recentActivity: { $sum: 1 }
                }
            },
            {
                $match: {
                    totalPriceChange: { $gt: 0 }
                }
            },
            { $sort: { totalPriceChange: -1 } },
            { $limit: limit }
        ]);

        // Get identity data
        const tokenIds = trending.map(t => t._id);
        const identities = await Identity.find({
            tokenId: { $in: tokenIds }
        }).lean();

        const identityMap = identities.reduce((map, identity) => {
            map[identity.tokenId] = identity;
            return map;
        }, {} as { [key: number]: any });

        const trendingWithData = trending.map(trend => ({
            tokenId: trend._id,
            identity: identityMap[trend._id],
            priceChange: trend.totalPriceChange,
            priceChangePercent: trend.priceChangePercent,
            recentActivity: trend.recentActivity,
            isListed: false // You'd check MarketplaceListing here
        }));

        res.json({
            success: true,
            trending: trendingWithData
        });

    } catch (error) {
        console.error('Error getting trending NFTs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get trending NFTs'
        });
    }
});

export default router;