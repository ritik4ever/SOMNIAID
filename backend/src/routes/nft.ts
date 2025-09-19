import express, { Request, Response } from 'express';
import Identity from '../models/Identity';
import NFTTransfer from '../models/NFTTransfer';
import MarketplaceListing from '../models/MarketplaceListing';
import PriceHistory from '../models/PriceHistory';
import BlockchainSyncService from '../services/blockchain-sync';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// ==================== NFT PURCHASE ROUTES ====================

// Buy an NFT from marketplace
router.post('/buy/:tokenId', async (req: Request, res: Response): Promise<void> => {
    try {
        const tokenId = parseInt(req.params.tokenId);
        const { buyerAddress, txHash } = req.body;

        if (!buyerAddress || !txHash) {
            res.status(400).json({
                success: false,
                error: 'Buyer address and transaction hash are required'
            });
            return;
        }

        console.log(`💰 Processing NFT purchase: Token #${tokenId} by ${buyerAddress}`);

        // Get the active listing
        const listing = await MarketplaceListing.findOne({
            tokenId,
            isActive: true
        });

        if (!listing) {
            res.status(404).json({
                success: false,
                error: 'NFT is not listed for sale'
            });
            return;
        }

        // Get the identity data
        const identity = await Identity.findOne({ tokenId });
        if (!identity) {
            res.status(404).json({
                success: false,
                error: 'NFT identity not found'
            });
            return;
        }

        // Verify the buyer is not the seller
        if (listing.sellerAddress.toLowerCase() === buyerAddress.toLowerCase()) {
            res.status(400).json({
                success: false,
                error: 'Cannot buy your own NFT'
            });
            return;
        }

        // CRITICAL: Record the purchase in NFTTransfer
        const transfer = new NFTTransfer({
            token_id: tokenId,
            from_address: listing.sellerAddress.toLowerCase(),
            to_address: buyerAddress.toLowerCase(),
            price: listing.price,
            tx_hash: txHash,
            transfer_type: 'sale',
            timestamp: new Date()
        });

        await transfer.save();

        // CRITICAL: Update identity ownership ONLY if it's the original owner selling their identity
        if (identity.isOriginalOwner && identity.ownerAddress.toLowerCase() === listing.sellerAddress.toLowerCase()) {
            console.log(`👤 Original owner selling identity: ${identity.username}`);

            // Transfer identity ownership
            identity.ownerAddress = buyerAddress.toLowerCase();
            identity.isOriginalOwner = false; // They sold their identity
            identity.lastUpdate = Date.now();
            await identity.save();
        } else {
            console.log(`📦 NFT investment purchase: Token #${tokenId} → ${buyerAddress} (Identity stays with original creator)`);
            // This is just a portfolio investment - identity ownership stays the same
        }

        // Deactivate the listing
        listing.isActive = false;
        listing.soldAt = new Date();
        listing.soldTo = buyerAddress.toLowerCase();
        listing.soldPrice = listing.price;
        await listing.save();

        // Record price history
        const priceHistory = new PriceHistory({
            token_id: tokenId,
            old_price: identity.currentPrice,
            new_price: listing.price,
            price_change_percent: ((listing.price - identity.currentPrice) / identity.currentPrice) * 100,
            change_reason: `NFT sold on marketplace`,
            triggered_by: 'sale',
            tx_hash: txHash,
            timestamp: new Date()
        });
        await priceHistory.save();

        console.log(`✅ Purchase completed: Token #${tokenId} sold for ${listing.price} ETH`);

        // Emit real-time events
        if ((req as any).io) {
            (req as any).io.emit('nft_purchased', {
                tokenId,
                buyer: buyerAddress,
                seller: listing.sellerAddress,
                price: listing.price,
                identity: {
                    username: identity.username,
                    primarySkill: identity.primarySkill
                }
            });

            // Notify seller
            (req as any).io.to(listing.sellerAddress).emit('nft_sold', {
                tokenId,
                buyer: buyerAddress,
                price: listing.price,
                identity: {
                    username: identity.username
                }
            });

            // Notify buyer  
            (req as any).io.to(buyerAddress).emit('purchase_confirmed', {
                tokenId,
                price: listing.price,
                identity: {
                    username: identity.username
                }
            });
        }

        res.json({
            success: true,
            purchase: {
                tokenId,
                price: listing.price,
                seller: listing.sellerAddress,
                buyer: buyerAddress,
                txHash,
                identity: {
                    username: identity.username,
                    primarySkill: identity.primarySkill,
                    reputationScore: identity.reputationScore
                },
                isIdentityTransfer: identity.isOriginalOwner && identity.ownerAddress.toLowerCase() === listing.sellerAddress.toLowerCase()
            },
            message: 'NFT purchased successfully!'
        });

    } catch (error) {
        console.error('Error processing NFT purchase:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process purchase'
        });
    }
});

// Get NFT details
router.get('/:tokenId', async (req: Request, res: Response): Promise<void> => {
    try {
        const tokenId = parseInt(req.params.tokenId);

        if (isNaN(tokenId)) {
            res.status(400).json({
                success: false,
                error: 'Invalid token ID'
            });
            return;
        }

        // Get identity data
        const identity = await Identity.findOne({ tokenId }).lean();
        if (!identity) {
            res.status(404).json({
                success: false,
                error: 'NFT not found'
            });
            return;
        }

        // Get marketplace listing status
        const listing = await MarketplaceListing.findOne({
            tokenId,
            isActive: true
        }).lean();

        // Get price history
        const priceHistory = await PriceHistory.find({ token_id: tokenId })
            .sort({ timestamp: -1 })
            .limit(10)
            .lean();

        // Get transfer history
        const transferHistory = await NFTTransfer.find({ token_id: tokenId })
            .sort({ timestamp: -1 })
            .limit(5)
            .lean();

        res.json({
            success: true,
            nft: {
                tokenId: identity.tokenId,
                username: identity.username,
                primarySkill: identity.primarySkill,
                ownerAddress: identity.ownerAddress,
                isOriginalOwner: identity.isOriginalOwner,
                reputationScore: identity.reputationScore,
                skillLevel: identity.skillLevel,
                achievementCount: identity.achievementCount,
                isVerified: identity.isVerified,
                currentPrice: identity.currentPrice,
                basePrice: identity.nftBasePrice,
                profile: identity.profile,
                lastUpdate: identity.lastUpdate
            },
            marketplace: {
                isListed: !!listing,
                listingPrice: listing?.price || null,
                listedAt: listing?.listedAt || null,
                seller: listing?.sellerAddress || null
            },
            history: {
                priceHistory,
                transferHistory
            }
        });

    } catch (error) {
        console.error('Error getting NFT details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get NFT details'
        });
    }
});

// Transfer NFT (for direct transfers, not marketplace)
router.post('/transfer', async (req: Request, res: Response): Promise<void> => {
    try {
        const { tokenId, fromAddress, toAddress, txHash } = req.body;

        if (!tokenId || !fromAddress || !toAddress || !txHash) {
            res.status(400).json({
                success: false,
                error: 'Token ID, from address, to address, and transaction hash are required'
            });
            return;
        }

        console.log(`🔄 Processing NFT transfer: Token #${tokenId} ${fromAddress} → ${toAddress}`);

        // Get identity
        const identity = await Identity.findOne({ tokenId });
        if (!identity) {
            res.status(404).json({
                success: false,
                error: 'NFT not found'
            });
            return;
        }

        // Record transfer
        const transfer = new NFTTransfer({
            token_id: tokenId,
            from_address: fromAddress.toLowerCase(),
            to_address: toAddress.toLowerCase(),
            price: 0, // Free transfer
            tx_hash: txHash,
            transfer_type: 'transfer',
            timestamp: new Date()
        });

        await transfer.save();

        // CRITICAL: Only update identity ownership if original owner is transferring
        if (identity.isOriginalOwner && identity.ownerAddress.toLowerCase() === fromAddress.toLowerCase()) {
            identity.ownerAddress = toAddress.toLowerCase();
            identity.lastUpdate = Date.now();
            await identity.save();

            console.log(`👤 Identity transferred: ${identity.username} → ${toAddress}`);
        } else {
            console.log(`📦 NFT portfolio transfer: Token #${tokenId} (identity ownership unchanged)`);
        }

        res.json({
            success: true,
            transfer: {
                tokenId,
                from: fromAddress,
                to: toAddress,
                txHash,
                isIdentityTransfer: identity.isOriginalOwner && identity.ownerAddress.toLowerCase() === fromAddress.toLowerCase()
            },
            message: 'NFT transferred successfully'
        });

    } catch (error) {
        console.error('Error transferring NFT:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to transfer NFT'
        });
    }
});

// ==================== NFT ANALYTICS ====================

// Get NFT transfer history
router.get('/:tokenId/history', async (req: Request, res: Response): Promise<void> => {
    try {
        const tokenId = parseInt(req.params.tokenId);
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const transfers = await NFTTransfer.find({ token_id: tokenId })
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await NFTTransfer.countDocuments({ token_id: tokenId });

        // Calculate analytics
        const totalVolume = transfers.reduce((sum, t) => sum + (t.price || 0), 0);
        const salesCount = transfers.filter(t => t.transfer_type === 'sale').length;

        res.json({
            success: true,
            transfers,
            analytics: {
                totalTransfers: total,
                salesCount,
                totalVolume,
                averagePrice: salesCount > 0 ? totalVolume / salesCount : 0
            },
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total
            }
        });

    } catch (error) {
        console.error('Error getting NFT history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get NFT history'
        });
    }
});

// Get NFT price history
router.get('/:tokenId/price-history', async (req: Request, res: Response): Promise<void> => {
    try {
        const tokenId = parseInt(req.params.tokenId);
        const days = parseInt(req.query.days as string) || 30;

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const priceHistory = await PriceHistory.find({
            token_id: tokenId,
            timestamp: { $gte: cutoffDate }
        }).sort({ timestamp: 1 }).lean();

        // Calculate price change statistics
        if (priceHistory.length > 0) {
            const firstPrice = priceHistory[0].old_price;
            const lastPrice = priceHistory[priceHistory.length - 1].new_price;
            const totalChange = lastPrice - firstPrice;
            const percentChange = (totalChange / firstPrice) * 100;

            res.json({
                success: true,
                priceHistory,
                analytics: {
                    firstPrice,
                    lastPrice,
                    totalChange,
                    percentChange,
                    dataPoints: priceHistory.length,
                    periodDays: days
                }
            });
        } else {
            const identity = await Identity.findOne({ tokenId }).select('currentPrice nftBasePrice');

            res.json({
                success: true,
                priceHistory: [],
                analytics: {
                    firstPrice: identity?.nftBasePrice || 0,
                    lastPrice: identity?.currentPrice || 0,
                    totalChange: 0,
                    percentChange: 0,
                    dataPoints: 0,
                    periodDays: days
                }
            });
        }

    } catch (error) {
        console.error('Error getting price history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get price history'
        });
    }
});

// Get all NFTs (with pagination and filters)
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const sortBy = req.query.sortBy as string || 'reputationScore';
        const sortOrder = req.query.sortOrder as string || 'desc';
        const skill = req.query.skill as string;
        const minPrice = parseFloat(req.query.minPrice as string) || 0;
        const maxPrice = parseFloat(req.query.maxPrice as string) || Infinity;
        const skip = (page - 1) * limit;

        // Build filter
        let filter: any = {
            currentPrice: { $gte: minPrice, $lte: maxPrice }
        };

        if (skill) {
            filter.primarySkill = new RegExp(skill, 'i');
        }

        const identities = await Identity.find(filter)
            .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await Identity.countDocuments(filter);

        // Check marketplace status for each
        const tokenIds = identities.map(id => id.tokenId);
        const listings = await MarketplaceListing.find({
            tokenId: { $in: tokenIds },
            isActive: true
        }).lean();

        const listingMap = listings.reduce((map, listing) => {
            map[listing.tokenId] = listing;
            return map;
        }, {} as { [key: number]: any });

        const enrichedNFTs = identities.map(identity => ({
            tokenId: identity.tokenId,
            username: identity.username,
            primarySkill: identity.primarySkill,
            reputationScore: identity.reputationScore,
            skillLevel: identity.skillLevel,
            achievementCount: identity.achievementCount,
            isVerified: identity.isVerified,
            currentPrice: identity.currentPrice,
            basePrice: identity.nftBasePrice,
            ownerAddress: identity.ownerAddress,
            isOriginalOwner: identity.isOriginalOwner,
            marketplace: {
                isListed: !!listingMap[identity.tokenId],
                listingPrice: listingMap[identity.tokenId]?.price || null,
                listedAt: listingMap[identity.tokenId]?.listedAt || null
            },
            profile: {
                bio: identity.profile?.bio || '',
                skills: identity.profile?.skills || [],
                achievements: identity.profile?.achievements?.slice(0, 3) || [] // Show first 3
            }
        }));

        res.json({
            success: true,
            nfts: enrichedNFTs,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Error getting NFTs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get NFTs'
        });
    }
});

export default router;