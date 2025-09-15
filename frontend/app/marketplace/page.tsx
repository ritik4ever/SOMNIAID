'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, TrendingUp, Star, ShoppingCart, Eye, ExternalLink, Trophy, Zap } from 'lucide-react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { formatEther, parseEther } from 'viem'
import Link from 'next/link'
import { api } from '@/utils/api'
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/utils/contract'
import toast from 'react-hot-toast'

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

    const { address, isConnected } = useAccount()
    const { writeContract, data: hash, isPending } = useWriteContract()
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash,
    })

    // Get listed identities from contract
    const { data: listedData, refetch: refetchListings } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getListedIdentities',
        query: { enabled: !!CONTRACT_ADDRESS }
    })

    useEffect(() => {
        loadMarketplaceItems()
    }, [listedData])

    useEffect(() => {
        filterAndSortItems()
    }, [items, searchQuery, sortBy, filter])

    const loadMarketplaceItems = async () => {
        try {
            setLoading(true)

            if (listedData && Array.isArray(listedData) && listedData.length === 2) {
                const tokenIds = listedData[0] as readonly bigint[]
                const prices = listedData[1] as readonly bigint[]

                console.log('Listed tokens:', tokenIds, 'Prices:', prices)

                if (tokenIds.length === 0) {
                    // No listings, show demo data
                    setItems(generateDemoMarketplaceData())
                    setLoading(false)
                    return
                }

                // Get identity details for each listed token
                const marketplaceItems: MarketplaceItem[] = []

                for (let i = 0; i < tokenIds.length; i++) {
                    try {
                        // Get identity from your API
                        const response = await api.getIdentity(Number(tokenIds[i]))

                        // Create fallback data first
                        const fallbackData = {
                            tokenId: Number(tokenIds[i]),
                            username: `Identity #${tokenIds[i]}`,
                            primarySkill: 'Unknown Skill',
                            reputationScore: 100,
                            skillLevel: 1,
                            achievementCount: 0,
                            currentPrice: prices[i],
                            isVerified: false,
                            isForSale: true,
                            seller: '0x...',
                            profile: {}
                        }

                        if (response.success && response.data && typeof response.data === 'object') {
                            const data = response.data as any

                            marketplaceItems.push({
                                ...fallbackData,
                                username: data.username || fallbackData.username,
                                primarySkill: data.primarySkill || fallbackData.primarySkill,
                                reputationScore: data.reputationScore || fallbackData.reputationScore,
                                skillLevel: data.skillLevel || fallbackData.skillLevel,
                                achievementCount: data.achievementCount || fallbackData.achievementCount,
                                isVerified: data.isVerified || fallbackData.isVerified,
                                seller: data.ownerAddress || fallbackData.seller,
                                profile: data.profile || fallbackData.profile
                            })
                        } else {
                            // Use fallback data if API response is invalid
                            marketplaceItems.push(fallbackData)
                        }
                    } catch (error) {
                        console.error(`Error loading identity ${tokenIds[i]}:`, error)
                        // Add fallback item if everything fails
                        marketplaceItems.push({
                            tokenId: Number(tokenIds[i]),
                            username: `Identity #${tokenIds[i]}`,
                            primarySkill: 'Unknown Skill',
                            reputationScore: 100,
                            skillLevel: 1,
                            achievementCount: 0,
                            currentPrice: prices[i],
                            isVerified: false,
                            isForSale: true,
                            seller: '0x...',
                            profile: {}
                        })
                    }
                }

                setItems(marketplaceItems)
            } else {
                // No contract data, show demo
                setItems(generateDemoMarketplaceData())
            }
        } catch (error) {
            console.error('Error loading marketplace:', error)
            setItems(generateDemoMarketplaceData())
        } finally {
            setLoading(false)
        }
    }

    const generateDemoMarketplaceData = (): MarketplaceItem[] => {
        // Return empty array 
        return []
    }

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

        // Sort items
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

            writeContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'buyIdentity',
                args: [BigInt(item.tokenId)],
                value: item.currentPrice
            })

            toast.loading('Processing purchase...')
        } catch (error: any) {
            console.error('Error buying NFT:', error)
            toast.error(error.message || 'Failed to buy NFT')
            setBuyingTokenId(null)
        }
    }

    useEffect(() => {
        if (isConfirmed && buyingTokenId) {
            toast.dismiss()
            toast.success('NFT purchased successfully!')
            setBuyingTokenId(null)
            refetchListings() // Refresh listings
            loadMarketplaceItems() // Refresh marketplace
        }
    }, [isConfirmed, buyingTokenId])

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
                            {(() => {
                                if (listedData && Array.isArray(listedData) && listedData.length >= 2) {
                                    const tokenIds = listedData[0] as readonly bigint[]
                                    return tokenIds.length === 0
                                        ? "No identities are currently listed for sale"
                                        : "Try adjusting your search or filters"
                                }
                                return "Loading marketplace data..."
                            })()}
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
                                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300"
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
                                                ~${(Number(formatEther(item.currentPrice)) * 0.1).toFixed(2)} USD
                                            </div>
                                        </div>
                                    </div>

                                    {/* Buy Button */}
                                    <button
                                        onClick={() => {
                                            // Check if this is demo data
                                            if (item.tokenId >= 1001) {
                                                toast.error('This is demo data. Real NFTs will have lower token IDs.')
                                                return
                                            }
                                            handleBuyNFT(item)
                                        }}
                                        disabled={!isConnected || buyingTokenId === item.tokenId || isPending || isConfirming || item.tokenId >= 1001}
                                        className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-300 flex items-center justify-center space-x-2 ${item.tokenId >= 1001
                                            ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed'
                                            }`}
                                    >
                                        {item.tokenId >= 1001 ? (
                                            <>
                                                <span>Demo NFT</span>
                                            </>
                                        ) : buyingTokenId === item.tokenId ? (
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