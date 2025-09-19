'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, TrendingUp, Star, ShoppingCart, Eye, ExternalLink, Trophy, Zap } from 'lucide-react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi'
import { formatEther, parseEther } from 'viem'
import Link from 'next/link'
import { marketplaceAPI, nftAPI, api } from '@/utils/api'
import { CONTRACT_ABI, CONTRACT_ADDRESS, getListedIdentities, canBuyNFT, estimateBuyGas } from '@/utils/contract'
import { useNFTEventSync } from '@/hooks/useNFTEventSync'
import toast from 'react-hot-toast'
import { API_BASE_URL } from '@/utils/api'

interface MarketplaceItem {
    tokenId: number
    username: string
    primarySkill: string
    reputationScore: number
    skillLevel: number
    achievementCount: number
    currentPrice: bigint
    isVerified: boolean
    isForSale: boolean
    seller: string
    profile?: {
        bio?: string
        skills?: string[]
        achievements?: any[]
    }
}

export default function MarketplacePage() {
    const [items, setItems] = useState<MarketplaceItem[]>([])
    const [filteredItems, setFilteredItems] = useState<MarketplaceItem[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState('price_asc')
    const [filter, setFilter] = useState('all')
    const [buyingTokenId, setBuyingTokenId] = useState<number | null>(null)
    const [lastRefresh, setLastRefresh] = useState(Date.now())
    const [debugMode, setDebugMode] = useState(false)

    const { address, isConnected } = useAccount()
    const { writeContract, data: hash, isPending } = useWriteContract()
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash,
    })

    const publicClient = usePublicClient()

    // Initial load
    useEffect(() => {
        loadMarketplaceItems()
    }, [publicClient])

    // Filter and sort items
    useEffect(() => {
        filterAndSortItems()
    }, [items, searchQuery, sortBy, filter])

    // Comprehensive refresh system
    useEffect(() => {
        let refreshTimeout: NodeJS.Timeout

        const handleRefresh = (eventType: string) => {
            console.log(`🔄 Marketplace refresh triggered: ${eventType}`)

            if (refreshTimeout) clearTimeout(refreshTimeout)

            refreshTimeout = setTimeout(() => {
                setLastRefresh(Date.now())
                loadMarketplaceItems()
            }, 3000)
        }

        const handleMarketplaceRefresh = () => handleRefresh('marketplace_refresh')
        const handleIdentityListed = () => handleRefresh('identity_listed')
        const handleIdentityPurchased = () => handleRefresh('identity_purchased')
        const handlePortfolioRefresh = () => handleRefresh('portfolio_refresh')

        window.addEventListener('marketplaceRefresh', handleMarketplaceRefresh)
        window.addEventListener('identityListed', handleIdentityListed)
        window.addEventListener('identityPurchased', handleIdentityPurchased)
        window.addEventListener('portfolioRefresh', handlePortfolioRefresh)
        window.addEventListener('nft_listed', handleMarketplaceRefresh)

        return () => {
            if (refreshTimeout) clearTimeout(refreshTimeout)
            window.removeEventListener('marketplaceRefresh', handleMarketplaceRefresh)
            window.removeEventListener('identityListed', handleIdentityListed)
            window.removeEventListener('identityPurchased', handleIdentityPurchased)
            window.removeEventListener('portfolioRefresh', handlePortfolioRefresh)
            window.removeEventListener('nft_listed', handleMarketplaceRefresh)
        }
    }, [])

    // NFT event sync
    useNFTEventSync({
        onIdentityCreated: () => {
            console.log('Identity created - refreshing marketplace')
            window.dispatchEvent(new CustomEvent('marketplaceRefresh'))
        },
        onIdentityPurchased: () => {
            console.log('Identity purchased - refreshing marketplace')
            window.dispatchEvent(new CustomEvent('marketplaceRefresh'))
        },
        refreshIdentity: () => {
            console.log('Identity updated - refreshing marketplace')
            window.dispatchEvent(new CustomEvent('marketplaceRefresh'))
        }
    })

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                console.log('⏰ Periodic marketplace refresh')
                loadMarketplaceItems()
                setLastRefresh(Date.now())
            }
        }, 30000)

        return () => clearInterval(interval)
    }, [])

    // Page visibility refresh
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('👀 Page became visible - refreshing marketplace')
                setTimeout(() => {
                    loadMarketplaceItems()
                    setLastRefresh(Date.now())
                }, 1000)
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [])

    const loadMarketplaceItems = async () => {
        try {
            setLoading(true);
            console.log('🔄 Loading marketplace items...');

            // Method 1: Try the API endpoint first
            try {
                // Uses API_BASE_URL for both local and production
                const response = await fetch(`${API_BASE_URL}/api/marketplace/listings`);
                const data = await response.json();

                if (data.success && data.listings && data.listings.length > 0) {
                    console.log(`✅ Loaded ${data.listings.length} listings from API`);

                    const formattedItems = data.listings.map((listing: any) => ({
                        tokenId: listing.tokenId,
                        username: listing.username,
                        primarySkill: listing.primarySkill,
                        reputationScore: listing.reputationScore,
                        skillLevel: listing.skillLevel,
                        achievementCount: listing.achievementCount,
                        currentPrice: BigInt(listing.currentPrice),
                        isVerified: listing.isVerified,
                        isForSale: true,
                        seller: listing.seller
                    }));

                    setItems(formattedItems);
                    setLoading(false);
                    return;
                }
            } catch (apiError) {
                console.error('API endpoint failed, trying contract directly:', apiError);
            }

            // Method 2: Direct contract calls
            if (!publicClient) {
                console.log('PublicClient not available yet');
                return;
            }

            console.log('📞 Using direct contract calls...');

            const [tokenIds, prices] = await getListedIdentities(publicClient);
            console.log('📋 Listed tokens from contract:', tokenIds.length);

            if (tokenIds.length === 0) {
                console.log('⚠️ No tokens listed for sale');
                setItems([]);
                setLoading(false);
                return;
            }

            const marketplaceItems: MarketplaceItem[] = [];

            for (let i = 0; i < tokenIds.length; i++) {
                try {
                    const tokenId = Number(tokenIds[i]);
                    const price = prices[i];

                    console.log(`🔍 Processing token ${tokenId}...`);

                    let username = `Identity #${tokenId}`;
                    let identityData: any = null;

                    // Try backend first - UPDATED: Uses API_BASE_URL
                    try {
                        const backendResponse = await fetch(`${API_BASE_URL}/api/identity/${tokenId}`);
                        if (backendResponse.ok) {
                            const backendResult = await backendResponse.json();
                            if (backendResult.success && backendResult.identity) {
                                identityData = backendResult.identity;
                                username = backendResult.identity.username || username;
                                console.log(`✅ Got username from backend: ${username}`);
                            }
                        }
                    } catch (backendError) {
                        console.log(`⚠️ Backend API failed for token ${tokenId}, using contract`);
                    }

                    // Fallback to contract
                    if (!identityData) {
                        try {
                            const contractIdentity = await publicClient.readContract({
                                address: CONTRACT_ADDRESS,
                                abi: CONTRACT_ABI,
                                functionName: 'getIdentity',
                                args: [BigInt(tokenId)]
                            }) as any;

                            identityData = {
                                tokenId,
                                username,
                                primarySkill: contractIdentity.primarySkill || 'Unknown',
                                reputationScore: Number(contractIdentity.reputationScore || 100),
                                skillLevel: Number(contractIdentity.skillLevel || 1),
                                achievementCount: Number(contractIdentity.achievementCount || 0),
                                isVerified: contractIdentity.isVerified || false
                            };
                        } catch (contractError) {
                            console.error(`Error getting contract identity for ${tokenId}:`, contractError);
                            continue;
                        }
                    }

                    // Get seller
                    let seller = '0x...';
                    try {
                        seller = await publicClient.readContract({
                            address: CONTRACT_ADDRESS,
                            abi: CONTRACT_ABI,
                            functionName: 'ownerOf',
                            args: [BigInt(tokenId)]
                        }) as string;
                    } catch (sellerError) {
                        console.error(`Error getting seller for ${tokenId}:`, sellerError);
                    }

                    const marketplaceItem: MarketplaceItem = {
                        tokenId: identityData.tokenId,
                        username: identityData.username,
                        primarySkill: identityData.primarySkill,
                        reputationScore: identityData.reputationScore,
                        skillLevel: identityData.skillLevel,
                        achievementCount: identityData.achievementCount,
                        currentPrice: price,
                        isVerified: identityData.isVerified,
                        isForSale: true,
                        seller: seller,
                        profile: identityData.profile || {}
                    };

                    marketplaceItems.push(marketplaceItem);
                    console.log(`✅ Added marketplace item: ${identityData.username}`);

                } catch (itemError) {
                    console.error(`Error processing token ${tokenIds[i]}:`, itemError);
                }
            }

            console.log(`📊 Total marketplace items loaded: ${marketplaceItems.length}`);
            setItems(marketplaceItems);

        } catch (error) {
            console.error('❌ Error loading marketplace:', error);
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    const filterAndSortItems = () => {
        let filtered = items.filter(item => {
            const matchesSearch = item.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.primarySkill.toLowerCase().includes(searchQuery.toLowerCase())

            const matchesFilter = filter === 'all' ||
                (filter === 'verified' && item.isVerified) ||
                (filter === 'for_sale' && item.isForSale) ||
                (filter === 'high_value' && Number(formatEther(item.currentPrice)) > 50)

            return matchesSearch && matchesFilter && item.isForSale
        })

        filtered.sort((a, b) => {
            const aPrice = Number(formatEther(a.currentPrice))
            const bPrice = Number(formatEther(b.currentPrice))

            switch (sortBy) {
                case 'price_asc': return aPrice - bPrice
                case 'price_desc': return bPrice - aPrice
                case 'reputation': return b.reputationScore - a.reputationScore
                case 'achievements': return b.achievementCount - a.achievementCount
                case 'recent': return b.tokenId - a.tokenId
                default: return 0
            }
        })

        setFilteredItems(filtered)
    }

    const handleBuyNFT = async (item: MarketplaceItem) => {
        if (!isConnected || !address) {
            toast.error('Please connect your wallet')
            return
        }

        if (item.seller.toLowerCase() === address.toLowerCase()) {
            toast.error('You cannot buy your own NFT')
            return
        }

        try {
            setBuyingTokenId(item.tokenId)
            console.log(`🛒 Attempting to buy NFT #${item.tokenId} for ${formatEther(item.currentPrice)} ETH`);

            // Validate purchase
            const validation = await canBuyNFT(publicClient!, item.tokenId, address);
            if (!validation.canBuy) {
                toast.error(validation.reason || 'Cannot buy this NFT');
                setBuyingTokenId(null);
                return;
            }

            // Get current listing info
            const listingInfo = await publicClient!.readContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getListingInfo',
                args: [BigInt(item.tokenId)]
            }) as [boolean, bigint];

            if (!listingInfo[0]) {
                toast.error('NFT is no longer listed for sale');
                setBuyingTokenId(null);
                return;
            }

            const currentPrice = listingInfo[1];
            if (currentPrice !== item.currentPrice) {
                toast.error(`Price has changed. Current price: ${formatEther(currentPrice)} ETH`);
                setBuyingTokenId(null);
                return;
            }

            // Estimate gas
            let gasLimit;
            try {
                gasLimit = await estimateBuyGas(publicClient!, item.tokenId, address, currentPrice);
                console.log(`💨 Estimated gas: ${gasLimit}`);
            } catch (gasError) {
                console.warn('Gas estimation failed, using default:', gasError);
                gasLimit = BigInt(300000);
            }

            toast.loading('Preparing transaction...', { id: 'buying' });

            writeContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'buyIdentity',
                args: [BigInt(item.tokenId)],
                value: currentPrice,
                gas: gasLimit,
            });

            toast.loading(`Processing purchase of ${item.username}...`, { id: 'buying' });

        } catch (error: any) {
            console.error('Error buying NFT:', error);
            toast.dismiss('buying');

            let errorMessage = 'Failed to buy NFT';

            if (error.message?.includes('insufficient funds')) {
                errorMessage = 'Insufficient funds for transaction';
            } else if (error.message?.includes('user rejected')) {
                errorMessage = 'Transaction rejected by user';
            } else if (error.message?.includes('gas')) {
                errorMessage = 'Transaction failed due to gas issues';
            } else if (error.shortMessage) {
                errorMessage = error.shortMessage;
            } else if (error.message) {
                errorMessage = error.message;
            }

            toast.error(errorMessage);
            setBuyingTokenId(null);
        }
    }

    // Handle successful purchase
    useEffect(() => {
        if (isConfirmed && buyingTokenId && hash) {
            const updateAfterPurchase = async () => {
                try {
                    toast.dismiss('buying');
                    toast.success('🎉 NFT purchased successfully!');

                    try {
                        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/nft/buy`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                tokenId: buyingTokenId,
                                buyer: address,
                                txHash: hash
                            })
                        });

                        if (response.ok) {
                            console.log('✅ Backend synced successfully');
                        }
                    } catch (backendError) {
                        console.warn('Backend sync failed (non-critical):', backendError);
                    }

                    setTimeout(() => {
                        loadMarketplaceItems();
                        window.dispatchEvent(new CustomEvent('portfolioRefresh'));
                        window.dispatchEvent(new CustomEvent('marketplaceRefresh'));
                    }, 3000);

                } catch (error) {
                    console.error('Error in post-purchase update:', error);
                } finally {
                    setBuyingTokenId(null);
                }
            };

            updateAfterPurchase();
        }
    }, [isConfirmed, buyingTokenId, hash, address]);

    // Debug functions
    const debugMarketplaceRefresh = () => {
        console.log('🐛 DEBUG: Manual refresh triggered')
        console.log('🐛 Current items count:', items.length)
        setLastRefresh(Date.now())
        loadMarketplaceItems()
    }

    const debugBlockchainState = async () => {
        if (!publicClient) return

        try {
            console.log('🐛 DEBUG: Checking blockchain state...')

            const totalIdentities = await publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getTotalIdentities'
            }) as bigint

            console.log(`🐛 Total identities on chain: ${totalIdentities}`)

            for (let i = 12; i <= Number(totalIdentities); i++) {
                try {
                    const listingInfo = await publicClient.readContract({
                        address: CONTRACT_ADDRESS,
                        abi: CONTRACT_ABI,
                        functionName: 'getListingInfo',
                        args: [BigInt(i)]
                    }) as [boolean, bigint]

                    console.log(`🐛 Token ${i}: Listed=${listingInfo[0]}, Price=${Number(listingInfo[1]) / 1e18} STT`)
                } catch (e) {
                    console.log(`🐛 Token ${i}: Does not exist`)
                }
            }
        } catch (error) {
            console.error('🐛 Debug error:', error)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen pt-20 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading marketplace...</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen pt-20 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                        NFT <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Marketplace</span>
                    </h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Trade SomniaID profiles and invest in rising talent
                    </p>
                </motion.div>

                {/* Debug Panel */}
                <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-white">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => setDebugMode(!debugMode)}
                                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                            >
                                {debugMode ? 'Hide' : 'Show'} Debug Tools
                            </button>
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-sm text-gray-600">Live | Last refresh: {new Date(lastRefresh).toLocaleTimeString()}</span>
                            </div>
                        </div>
                        <div className="text-sm text-gray-600">
                            Showing {filteredItems.length} of {items.length} listings
                        </div>
                    </div>

                    {debugMode && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <button
                                onClick={debugMarketplaceRefresh}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                            >
                                🔄 Manual Refresh
                            </button>

                            <button
                                onClick={() => {
                                    console.log('🧪 Testing event emission')
                                    window.dispatchEvent(new CustomEvent('marketplaceRefresh'))
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                            >
                                🧪 Test Event
                            </button>

                            <button
                                onClick={debugBlockchainState}
                                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                            >
                                🔍 Check Blockchain
                            </button>

                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"
                            >
                                🔄 Hard Refresh
                            </button>
                        </div>
                    )}
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                        <div className="text-2xl font-bold text-blue-600">{filteredItems.length}</div>
                        <div className="text-sm text-gray-600">For Sale</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                        <div className="text-2xl font-bold text-green-600">
                            {Math.round(Number(formatEther(
                                filteredItems.reduce((sum, item) => sum + item.currentPrice, BigInt(0))
                            )))} STT
                        </div>
                        <div className="text-sm text-gray-600">Total Value</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                        <div className="text-2xl font-bold text-purple-600">
                            {filteredItems.length > 0 ? Math.round(Number(formatEther(
                                filteredItems.reduce((sum, item) => sum + item.currentPrice, BigInt(0))
                            )) / filteredItems.length) : 0} STT
                        </div>
                        <div className="text-sm text-gray-600">Avg Price</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                        <div className="text-2xl font-bold text-orange-600">
                            {filteredItems.filter(item => item.isVerified).length}
                        </div>
                        <div className="text-sm text-gray-600">Verified</div>
                    </div>
                </div>

                {/* Search & Filters */}
                <div className="mb-8 flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by username or skill..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
                        />
                    </div>

                    <div className="flex items-center space-x-4">
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                        >
                            <option value="all">All NFTs</option>
                            <option value="verified">Verified Only</option>
                            <option value="for_sale">For Sale</option>
                            <option value="high_value">High Value (50+ STT)</option>
                        </select>

                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                        >
                            <option value="price_asc">Price: Low to High</option>
                            <option value="price_desc">Price: High to Low</option>
                            <option value="reputation">Highest Reputation</option>
                            <option value="achievements">Most Achievements</option>
                            <option value="recent">Recently Listed</option>
                        </select>
                    </div>
                </div>

                {/* Marketplace Grid */}
                {filteredItems.length === 0 ? (
                    <div className="text-center py-16">
                        <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">No NFTs available</h3>
                        <p className="text-gray-500 mb-4">
                            {items.length === 0 && !loading
                                ? "No identities are currently listed for sale"
                                : "Try adjusting your search or filters"
                            }
                        </p>
                        <Link
                            href="/dashboard"
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Create Identity to List
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredItems.map((item, index) => (
                            <motion.div
                                key={item.tokenId}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 cursor-pointer hover:scale-105"
                                onClick={() => {
                                    if (item.tokenId < 1000) {
                                        window.location.href = `/identity/${item.tokenId}`
                                    } else {
                                        toast.error('This is demo data - real NFTs will be clickable')
                                    }
                                }}
                            >
                                {/* NFT Header */}
                                <div className="p-4 border-b border-gray-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                                                <span className="text-white font-bold text-sm">
                                                    {item.username.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="flex items-center space-x-1">
                                                    <span className="font-semibold text-gray-900">{item.username}</span>
                                                    {item.isVerified && (
                                                        <span className="text-green-600">✓</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500">#{item.tokenId}</div>
                                            </div>
                                        </div>
                                        <a
                                            href={`https://shannon-explorer.somnia.network/token/${CONTRACT_ADDRESS}?a=${item.tokenId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-gray-400 hover:text-gray-600"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    </div>
                                    <p className="text-sm text-gray-600">{item.primarySkill}</p>
                                </div>

                                {/* Stats */}
                                <div className="p-4 space-y-3">
                                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                        <div>
                                            <div className="font-semibold text-blue-600">{item.reputationScore}</div>
                                            <div className="text-gray-500">Reputation</div>
                                        </div>
                                        <div>
                                            <div className="font-semibold text-yellow-600">{item.achievementCount}</div>
                                            <div className="text-gray-500">Achievements</div>
                                        </div>
                                        <div>
                                            <div className="font-semibold text-green-600">L{item.skillLevel}</div>
                                            <div className="text-gray-500">Level</div>
                                        </div>
                                    </div>

                                    {/* Price */}
                                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3">
                                        <div className="text-center">
                                            <div className="text-lg font-bold text-gray-900">
                                                {formatEther(item.currentPrice)} STT
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                ~${(Number(formatEther(item.currentPrice)) * 4.5).toFixed(2)} USD
                                            </div>
                                        </div>
                                    </div>

                                    {/* Buy Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleBuyNFT(item)
                                        }}
                                        disabled={!isConnected || buyingTokenId === item.tokenId || isPending || isConfirming}
                                        className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-300 flex items-center justify-center space-x-2 
                                            bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {buyingTokenId === item.tokenId ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>{isConfirming ? 'Confirming...' : 'Buying...'}</span>
                                            </>
                                        ) : (
                                            <>
                                                <ShoppingCart className="w-4 h-4" />
                                                <span>Buy Now</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}