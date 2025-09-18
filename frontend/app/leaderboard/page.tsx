'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Medal, Star, TrendingUp, TrendingDown, Crown, Award, ExternalLink } from 'lucide-react'
import { api } from '@/utils/api'
import toast from 'react-hot-toast'

interface LeaderboardEntry {
    rank: number
    tokenId: number
    username: string
    reputationScore: number
    achievementCount: number
    skillLevel: number
    primarySkill: string
    isVerified: boolean
    txHash?: string
    ownerAddress: string
}

export default function LeaderboardPage() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
    const [loading, setLoading] = useState(true)
    // ADDED: Price tracking state
    const [priceChanges, setPriceChanges] = useState<{ [key: number]: { change: number, trend: 'up' | 'down' | 'neutral' } }>({})

    useEffect(() => {
        loadLeaderboard()
    }, [])

    // ADDED: Listen for leaderboard refresh events
    useEffect(() => {
        const handleLeaderboardRefresh = () => {
            console.log('Leaderboard refresh event received')
            loadLeaderboard()

            // Simulate price changes for demo
            const changes: { [key: number]: { change: number, trend: 'up' | 'down' | 'neutral' } } = {}
            leaderboard.forEach(entry => {
                const change = (Math.random() - 0.5) * 10 // -5% to +5%
                changes[entry.tokenId] = {
                    change: Number(change.toFixed(2)),
                    trend: change > 1 ? 'up' : change < -1 ? 'down' : 'neutral'
                }
            })
            setPriceChanges(changes)
        }

        window.addEventListener('leaderboardRefresh', handleLeaderboardRefresh)

        // Update price changes every 30 seconds
        const priceInterval = setInterval(handleLeaderboardRefresh, 30000)

        return () => {
            window.removeEventListener('leaderboardRefresh', handleLeaderboardRefresh)
            clearInterval(priceInterval)
        }
    }, [leaderboard])

    const loadLeaderboard = async () => {
        try {
            setLoading(true)
            const response = await api.getIdentities(1, 50)

            if (response.success && response.identities?.length > 0) {
                const sortedIdentities = response.identities
                    .sort((a: any, b: any) => b.reputationScore - a.reputationScore)
                    .map((identity: any, index: number) => ({
                        rank: index + 1,
                        tokenId: identity.tokenId,
                        username: identity.username,
                        reputationScore: identity.reputationScore,
                        achievementCount: identity.achievementCount,
                        skillLevel: identity.skillLevel,
                        primarySkill: identity.primarySkill,
                        isVerified: identity.isVerified,
                        txHash: identity.txHash,
                        ownerAddress: identity.ownerAddress,
                        currentPrice: identity.currentPrice || 10
                    }))

                setLeaderboard(sortedIdentities)
            } else {
                // Only show empty state if no real data
                setLeaderboard([])
            }
        } catch (error) {
            console.error('Leaderboard error:', error)
            setLeaderboard([])
        } finally {
            setLoading(false)
        }
    }

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1:
                return <Crown className="w-6 h-6 text-yellow-500" />
            case 2:
                return <Medal className="w-6 h-6 text-gray-400" />
            case 3:
                return <Award className="w-6 h-6 text-amber-600" />
            default:
                return (
                    <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-purple-600 font-bold text-sm">{rank}</span>
                    </div>
                )
        }
    }

    const getRankColor = (rank: number) => {
        switch (rank) {
            case 1:
                return 'from-yellow-400 to-yellow-600'
            case 2:
                return 'from-gray-300 to-gray-500'
            case 3:
                return 'from-amber-400 to-amber-600'
            default:
                return 'from-purple-400 to-indigo-400'
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen pt-20 bg-gray-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-yellow-200 border-t-yellow-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading leaderboard...</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen pt-20 bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <div className="w-20 h-20 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Trophy className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                        <span className="bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                            Leaderboard
                        </span>
                    </h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Top performers on the Somnia Network, ranked by reputation and achievements
                    </p>
                </motion.div>

                <div className="space-y-4">
                    {leaderboard.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-16"
                        >
                            <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Rankings Yet</h3>
                            <p className="text-gray-500 mb-6">
                                Be the first to create an identity and start earning reputation!
                            </p>
                            <button
                                onClick={() => window.location.href = '/dashboard'}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300"
                            >
                                Create Your Identity
                            </button>
                        </motion.div>
                    ) : (
                        leaderboard.map((entry, index) => (
                            <motion.div
                                key={entry.tokenId}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={`relative overflow-hidden rounded-3xl p-6 cursor-pointer hover:scale-105 group ${entry.rank <= 3
                                    ? `bg-gradient-to-r ${getRankColor(entry.rank)} text-white shadow-2xl`
                                    : 'bg-white shadow-xl hover:shadow-2xl'
                                    } transition-all duration-300`}
                                onClick={() => {
                                    // ADDED: Click to view identity details
                                    window.location.href = `/identity/${entry.tokenId}`
                                }}
                            >
                                <div className="flex items-center space-x-6">
                                    <div className="flex-shrink-0">
                                        {getRankIcon(entry.rank)}
                                    </div>

                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${entry.rank <= 3 ? 'bg-white/20' : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                                        }`}>
                                        <span className="font-bold text-xl text-white">
                                            {entry.username?.charAt(0) || '#'}
                                        </span>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-2">
                                            <h3 className={`text-xl font-bold truncate ${entry.rank <= 3 ? 'text-white' : 'text-gray-900'
                                                }`}>
                                                {entry.username}
                                            </h3>
                                            {entry.isVerified && (
                                                <span className={entry.rank <= 3 ? 'text-white' : 'text-green-600'}>✓</span>
                                            )}
                                        </div>
                                        <p className={entry.rank <= 3 ? 'text-white/80' : 'text-gray-600'}>
                                            {entry.primarySkill}
                                        </p>
                                    </div>

                                    {/* UPDATED: Stats with price changes */}
                                    <div className="flex items-center space-x-8">
                                        <div className="text-center">
                                            <div className={`text-2xl font-bold ${entry.rank <= 3 ? 'text-white' : 'text-purple-600'
                                                }`}>
                                                {entry.reputationScore}
                                            </div>
                                            <div className={`text-sm ${entry.rank <= 3 ? 'text-white/80' : 'text-gray-600'
                                                }`}>
                                                Reputation
                                            </div>
                                        </div>

                                        <div className="text-center">
                                            <div className={`text-2xl font-bold ${entry.rank <= 3 ? 'text-white' : 'text-yellow-600'
                                                }`}>
                                                {entry.achievementCount}
                                            </div>
                                            <div className={`text-sm ${entry.rank <= 3 ? 'text-white/80' : 'text-gray-600'
                                                }`}>
                                                Achievements
                                            </div>
                                        </div>

                                        {/* ADDED: Price change indicator */}
                                        <div className="text-center">
                                            {priceChanges[entry.tokenId] ? (
                                                <>
                                                    <div className={`text-lg font-bold flex items-center justify-center ${priceChanges[entry.tokenId].trend === 'up' ? 'text-green-400' :
                                                        priceChanges[entry.tokenId].trend === 'down' ? 'text-red-400' :
                                                            entry.rank <= 3 ? 'text-white' : 'text-gray-600'
                                                        }`}>
                                                        {priceChanges[entry.tokenId].trend === 'up' && <TrendingUp className="w-4 h-4 mr-1" />}
                                                        {priceChanges[entry.tokenId].trend === 'down' && <TrendingDown className="w-4 h-4 mr-1" />}
                                                        {priceChanges[entry.tokenId].change >= 0 ? '+' : ''}
                                                        {priceChanges[entry.tokenId].change}%
                                                    </div>
                                                    <div className={`text-xs ${entry.rank <= 3 ? 'text-white/80' : 'text-gray-500'
                                                        }`}>
                                                        24h Change
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className={`text-lg font-bold ${entry.rank <= 3 ? 'text-white' : 'text-gray-600'
                                                        }`}>
                                                        --
                                                    </div>
                                                    <div className={`text-xs ${entry.rank <= 3 ? 'text-white/80' : 'text-gray-500'
                                                        }`}>
                                                        24h Change
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* ADDED: Click indicator */}
                                <div className={`absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity ${entry.rank <= 3 ? 'text-white/60' : 'text-gray-400'
                                    }`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}