'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Wallet, Star, ShoppingCart, Eye, ExternalLink, Plus, Minus } from 'lucide-react'
import { useAccount, useReadContract } from 'wagmi'
import { formatEther } from 'viem'
import Link from 'next/link'
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/utils/contract'

interface PortfolioItem {
    tokenId: number
    username: string
    primarySkill: string
    reputationScore: number
    currentPrice: number
    purchasePrice: number
    purchaseDate: Date
    priceChange: number
    priceChangePercent: number
    isVerified: boolean
    skillLevel: number
    achievementCount: number
    dailyVolume: number
    weeklyChange: number
}

export default function PortfolioPage() {
    const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
    const [loading, setLoading] = useState(true)
    const [totalValue, setTotalValue] = useState(0)
    const [totalInvested, setTotalInvested] = useState(0)
    const [totalPnL, setTotalPnL] = useState(0)
    const [selectedTimeframe, setSelectedTimeframe] = useState('24h')

    const { address, isConnected } = useAccount()

    // ADDED: Get user's balance from contract
    const { data: balance, refetch: refetchBalance } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: !!address && !!CONTRACT_ADDRESS }
    })

    // Helper function to safely format dates
    const formatDate = (date: any) => {
        if (!date) return 'Unknown'
        try {
            const dateObj = typeof date === 'string' ? new Date(date) : date
            return dateObj.toLocaleDateString()
        } catch (error) {
            return 'Invalid Date'
        }
    }

    // ADDED: Listen for portfolio refresh events
    useEffect(() => {
        const handlePortfolioRefresh = () => {
            console.log('Portfolio refresh event received')
            refetchBalance()
            if (address) {
                loadRealPortfolio()
            }
        }

        window.addEventListener('portfolioRefresh', handlePortfolioRefresh)
        return () => window.removeEventListener('portfolioRefresh', handlePortfolioRefresh)
    }, [address, refetchBalance])

    useEffect(() => {
        if (isConnected && address) {
            loadRealPortfolio()
        }
    }, [isConnected, address, balance])

    // ADDED: Load real portfolio data from contract
    console.log('Using contract address:', CONTRACT_ADDRESS)
    console.log('User address:', address)


    const loadRealPortfolio = async () => {
        try {
            setLoading(true);

            if (!address) {
                setPortfolio([]);
                setLoading(false);
                return;
            }

            // Use enhanced portfolio API
            const response = await fetch(`/api/portfolio/${address}`);
            const data = await response.json();

            if (data.success && data.ownedNFTs && data.ownedNFTs.length > 0) {
                setPortfolio(data.ownedNFTs);
                setTotalValue(data.totalValue);
                setTotalInvested(data.totalInvested);
                setTotalPnL(data.totalPnL);
            } else {
                setPortfolio([]);
                setTotalValue(0);
                setTotalInvested(0);
                setTotalPnL(0);
            }

        } catch (error) {
            console.error('Error loading portfolio:', error);
            setPortfolio([]);
        } finally {
            setLoading(false);
        }
    };

    // Keep original demo data as fallback
    const loadDemoPortfolio = () => {
        const demoPortfolio: PortfolioItem[] = [
            {
                tokenId: 1001,
                username: 'CryptoBuilder',
                primarySkill: 'Smart Contract Development',
                reputationScore: 850,
                currentPrice: 45.5,
                purchasePrice: 38.2,
                purchaseDate: new Date('2024-08-15'),
                priceChange: 7.3,
                priceChangePercent: 19.11,
                isVerified: true,
                skillLevel: 4,
                achievementCount: 12,
                dailyVolume: 2.3,
                weeklyChange: 12.5
            },
            {
                tokenId: 1002,
                username: 'NFTArtist',
                primarySkill: 'NFT Creation',
                reputationScore: 650,
                currentPrice: 28.9,
                purchasePrice: 32.1,
                purchaseDate: new Date('2024-08-20'),
                priceChange: -3.2,
                priceChangePercent: -9.97,
                isVerified: true,
                skillLevel: 3,
                achievementCount: 8,
                dailyVolume: 1.8,
                weeklyChange: -5.2
            },
            {
                tokenId: 1003,
                username: 'DeFiTrader',
                primarySkill: 'DeFi Protocol Design',
                reputationScore: 720,
                currentPrice: 67.2,
                purchasePrice: 55.8,
                purchaseDate: new Date('2024-08-10'),
                priceChange: 11.4,
                priceChangePercent: 20.43,
                isVerified: false,
                skillLevel: 3,
                achievementCount: 15,
                dailyVolume: 4.1,
                weeklyChange: 18.7
            }
        ]

        setPortfolio(demoPortfolio)

        const totalCurrentValue = demoPortfolio.reduce((sum, item) => sum + item.currentPrice, 0)
        const totalInvestedValue = demoPortfolio.reduce((sum, item) => sum + item.purchasePrice, 0)
        const totalPnLValue = totalCurrentValue - totalInvestedValue

        setTotalValue(totalCurrentValue)
        setTotalInvested(totalInvestedValue)
        setTotalPnL(totalPnLValue)
    }

    if (!isConnected) {
        return (
            <div className="min-h-screen pt-20 bg-gray-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
                    <Wallet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Connect Your Wallet</h1>
                    <p className="text-gray-600 mb-6">Connect your wallet to view your NFT portfolio</p>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="min-h-screen pt-20 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading your portfolio...</p>
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
                    className="mb-8"
                >
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">Your Portfolio</h1>
                    <p className="text-gray-600">Track your SomniaID NFT investments and performance</p>
                </motion.div>

                {/* Portfolio Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-600">Total Value</h3>
                            <Wallet className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                            {totalValue.toFixed(4)} STT
                        </div>
                        <div className="text-sm text-gray-500">
                            ~${(totalValue * 4.5).toFixed(2)} USD
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-600">Total Invested</h3>
                            <ShoppingCart className="w-5 h-5 text-gray-600" />
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                            {totalInvested.toFixed(4)} STT
                        </div>
                        <div className="text-sm text-gray-500">
                            ~${(totalInvested * 4.5).toFixed(2)} USD
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-600">Total P&L</h3>
                            {totalPnL >= 0 ? (
                                <TrendingUp className="w-5 h-5 text-green-600" />
                            ) : (
                                <TrendingDown className="w-5 h-5 text-red-600" />
                            )}
                        </div>
                        <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(4)} STT
                        </div>
                        <div className={`text-sm ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {totalPnL >= 0 ? '+' : ''}{totalInvested > 0 ? ((totalPnL / totalInvested) * 100).toFixed(2) : '0.00'}%
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-600">Holdings</h3>
                            <Star className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{portfolio.length}</div>
                        <div className="text-sm text-gray-500">NFTs owned</div>
                    </motion.div>
                </div>

                {/* Portfolio Holdings */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                >
                    <div className="p-6 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900">Your Holdings</h2>
                            <div className="flex items-center space-x-2">
                                <select
                                    value={selectedTimeframe}
                                    onChange={(e) => setSelectedTimeframe(e.target.value)}
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                >
                                    <option value="24h">24h</option>
                                    <option value="7d">7d</option>
                                    <option value="30d">30d</option>
                                </select>
                                <Link
                                    href="/marketplace"
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                                >
                                    Buy More
                                </Link>
                            </div>
                        </div>
                    </div>

                    {portfolio.length === 0 ? (
                        <div className="p-12 text-center">
                            <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-700 mb-2">No NFTs in portfolio</h3>
                            <p className="text-gray-500 mb-6">
                                {balance && Number(balance) === 0 ?
                                    "You don't own any SomniaID NFTs yet. Start building your collection!" :
                                    "Loading your NFTs..."
                                }
                            </p>
                            <Link
                                href="/marketplace"
                                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300"
                            >
                                Browse Marketplace
                            </Link>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            NFT
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Current Price
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Purchase Price
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            P&L
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            24h Change
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {portfolio.map((item, index) => (
                                        <motion.tr
                                            key={item.tokenId}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            className="hover:bg-gray-50 cursor-pointer"
                                            onClick={() => {
                                                // ADDED: Click to view NFT details
                                                if (item.tokenId < 1000) {
                                                    window.location.href = `/identity/${item.tokenId}`
                                                }
                                            }}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                                                        <span className="text-white font-bold text-sm">
                                                            {item.username.charAt(0)}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center space-x-2">
                                                            <span className="font-medium text-gray-900">{item.username}</span>
                                                            {item.isVerified && (
                                                                <span className="text-green-600">✓</span>
                                                            )}
                                                            {/* ADDED: Real vs Demo indicator */}
                                                            {item.tokenId >= 1000 && (
                                                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">Demo</span>
                                                            )}
                                                        </div>
                                                        <div className="text-sm text-gray-500">#{item.tokenId}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {item.currentPrice.toFixed(4)} STT
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    ${(item.currentPrice * 4.5).toFixed(2)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">
                                                    {item.purchasePrice.toFixed(4)} STT
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {formatDate(item.purchaseDate)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className={`text-sm font-medium ${item.priceChange >= 0 ? 'text-green-600' : 'text-red-600'
                                                    }`}>
                                                    {item.priceChange >= 0 ? '+' : ''}{item.priceChange.toFixed(4)} STT
                                                </div>
                                                <div className={`text-sm ${item.priceChangePercent >= 0 ? 'text-green-600' : 'text-red-600'
                                                    }`}>
                                                    {item.priceChangePercent >= 0 ? '+' : ''}{item.priceChangePercent.toFixed(2)}%
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className={`flex items-center text-sm font-medium ${item.weeklyChange >= 0 ? 'text-green-600' : 'text-red-600'
                                                    }`}>
                                                    {item.weeklyChange >= 0 ? (
                                                        <TrendingUp className="w-4 h-4 mr-1" />
                                                    ) : (
                                                        <TrendingDown className="w-4 h-4 mr-1" />
                                                    )}
                                                    {item.weeklyChange >= 0 ? '+' : ''}{item.weeklyChange.toFixed(2)}%
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <div className="flex items-center space-x-2">
                                                    {item.tokenId < 1000 ? (
                                                        <Link
                                                            href={`/identity/${item.tokenId}`}
                                                            className="text-blue-600 hover:text-blue-700"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </Link>
                                                    ) : (
                                                        <span className="text-gray-400">
                                                            <Eye className="w-4 h-4" />
                                                        </span>
                                                    )}
                                                    <button className="text-green-600 hover:text-green-700" title="List for Sale">
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                    <button className="text-red-600 hover:text-red-700" title="Transfer">
                                                        <Minus className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </motion.div>

                {/* Performance Chart Placeholder */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="mt-8 bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                >
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Portfolio Performance</h3>
                    <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                            <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-500">Performance chart coming soon</p>
                            {/* ADDED: Show total balance info */}
                            <p className="text-sm text-gray-400 mt-2">
                                {balance ? `You own ${Number(balance)} SomniaID NFT${Number(balance) === 1 ? '' : 's'}` : ''}
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}