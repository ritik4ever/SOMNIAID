'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, TrendingUp, Star, ShoppingCart, Eye, ExternalLink, Trophy, Zap } from 'lucide-react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import Link from 'next/link'
import { api } from '@/utils/api'
import toast from 'react-hot-toast'

interface MarketplaceItem {
    tokenId: number
    username: string
    primarySkill: string
    reputationScore: number
    skillLevel: number
    achievementCount: number
    currentPrice: number
    isVerified: boolean
    isForSale: boolean
    seller: string
    lastSalePrice?: number
    priceChange24h?: number
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

    useEffect(() => {
        loadMarketplaceItems()
    }, [])

    useEffect(() => {
        filterAndSortItems()
    }, [items, searchQuery, sortBy, filter])

    const loadMarketplaceItems = async () => {
        try {
            setLoading(true)
            const response = await api.getIdentities(1, 50)

            if (response.success && response.identities) {
                // Simulate marketplace data - in reality this would come from backend
                const marketplaceItems: MarketplaceItem[] = response.identities.map((identity: any) => ({
                    tokenId: identity.tokenId,
                    username: identity.username,
                    primarySkill: identity.primarySkill,
                    reputationScore: identity.reputationScore,
                    skillLevel: identity.skillLevel,
                    achievementCount: identity.achievementCount,
                    currentPrice: identity.currentPrice || 10,
                    isVerified: identity.isVerified,
                    isForSale: Math.random() > 0.3, // 70% chance of being for sale
                    seller: identity.ownerAddress,
                    lastSalePrice: (identity.currentPrice || 10) * (0.8 + Math.random() * 0.4),
                    priceChange24h: (Math.random() - 0.5) * 20, // -10% to +10%
                    profile: identity.profile
                }))

                setItems(marketplaceItems)
            } else {
                // Demo data if API fails
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
        return [
            {
                tokenId: 1001,
                username: 'CryptoBuilder',
                primarySkill: 'Smart Contract Development',
                reputationScore: 850,
                skillLevel: 4,
                achievementCount: 12,
                currentPrice: 45.5,
                isVerified: true,
                isForSale: true,
                seller: '0x1234...5678',
                lastSalePrice: 42.0,
                priceChange24h: 8.3,
                profile: {
                    bio: 'Senior blockchain developer with 5+ years experience',
                    skills: ['Solidity', 'Web3.js', 'DeFi'],
                    achievements: []
                }
            },
            {
                tokenId: 1002,
                username: 'NFTArtist',
                primarySkill: 'NFT Creation',
                reputationScore: 650,
                skillLevel: 3,
                achievementCount: 8,
                currentPrice: 28.9,
                isVerified: true,
                isForSale: true,
                seller: '0x2345...6789',
                lastSalePrice: 30.5,
                priceChange24h: -5.2,
                profile: {
                    bio: 'Digital artist creating unique NFT collections',
                    skills: ['Digital Art', 'Photoshop', 'Blender'],
                    achievements: []
                }
            },
            {
                tokenId: 1003,
                username: 'DeFiTrader',
                primarySkill: 'DeFi Protocol Design',
                reputationScore: 720,
                skillLevel: 3,
                achievementCount: 15,
                currentPrice: 67.2,
                isVerified: false,
                isForSale: true,
                seller: '0x3456...7890',
                lastSalePrice: 59.8,
                priceChange24h: 12.4,
                profile: {
                    bio: 'DeFi protocol architect and yield farmer',
                    skills: ['DeFi', 'Yield Farming', 'Liquidity Mining'],
                    achievements: []
                }
            }
        ]
    }

    const filterAndSortItems = () => {
        let filtered = items.filter(item => {
            const matchesSearch = item.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.primarySkill.toLowerCase().includes(searchQuery.toLowerCase())

            const matchesFilter = filter === 'all' ||
                (filter === 'verified' && item.isVerified) ||
                (filter === 'for_sale' && item.isForSale) ||
                (filter === 'high_value' && item.currentPrice > 50)

            return matchesSearch && matchesFilter && item.isForSale
        })

        // Sort items
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'price_asc': return a.currentPrice - b.currentPrice
                case 'price_desc': return b.currentPrice - a.currentPrice
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

            // Call marketplace contract (simplified)
            writeContract({
                address: process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT as `0x${string}`,
                abi: [
                    "function buyNFT(uint256 tokenId) external payable"
                ],
                functionName: 'buyNFT',
                args: [BigInt(item.tokenId)],
                value: parseEther(item.currentPrice.toString())
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
            toast.success('NFT purchased successfully!')
            setBuyingTokenId(null)
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
                    <div className="bg-white rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">{filteredItems.length}</div>
                        <div className="text-sm text-gray-600">For Sale</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">
                            {Math.round(filteredItems.reduce((sum, item) => sum + item.currentPrice, 0))} STT
                        </div>
                        <div className="text-sm text-gray-600">Total Value</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-purple-600">
                            {Math.round(filteredItems.reduce((sum, item) => sum + item.currentPrice, 0) / filteredItems.length || 0)} STT
                        </div>
                        <div className="text-sm text-gray-600">Avg Price</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 text-center">
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
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div className="flex items-center space-x-4">
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All NFTs</option>
                            <option value="verified">Verified Only</option>
                            <option value="for_sale">For Sale</option>
                            <option value="high_value">High Value (50+ STT)</option>
                        </select>

                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
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
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">No NFTs found</h3>
                        <p className="text-gray-500">Try adjusting your search or filters</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredItems.map((item, index) => (
                            <motion.div
                                key={item.tokenId}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-shadow"
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
                                        <Link href={`/profile/${item.tokenId}`}>
                                            <Eye className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                                        </Link>
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
                                    <div className="bg-gray-50 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-lg font-bold text-gray-900">
                                                    {item.currentPrice} STT
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    ~${(item.currentPrice * 0.1).toFixed(2)} USD
                                                </div>
                                            </div>
                                            {item.priceChange24h && (
                                                <div className={`text-xs font-medium ${item.priceChange24h > 0 ? 'text-green-600' : 'text-red-600'
                                                    }`}>
                                                    {item.priceChange24h > 0 ? '+' : ''}
                                                    {item.priceChange24h.toFixed(1)}%
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Buy Button */}
                                    <button
                                        onClick={() => handleBuyNFT(item)}
                                        disabled={!isConnected || buyingTokenId === item.tokenId || isPending}
                                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2 px-4 rounded-lg font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center space-x-2"
                                    >
                                        {buyingTokenId === item.tokenId ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Buying...</span>
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