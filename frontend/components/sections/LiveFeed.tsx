'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Trophy, TrendingUp, Star, Zap } from 'lucide-react'

interface FeedItem {
    id: string
    type: 'reputation' | 'achievement' | 'levelup' | 'identity'
    user: string
    message: string
    timestamp: number
    icon: any
    color: string
}

const mockFeedData: FeedItem[] = [
    {
        id: '1',
        type: 'achievement',
        user: 'CryptoBuilder',
        message: 'unlocked "Smart Contract Master" achievement',
        timestamp: Date.now() - 30000,
        icon: Trophy,
        color: 'text-yellow-500'
    },
    {
        id: '2',
        type: 'reputation',
        user: 'DeFiExplorer',
        message: 'gained +50 reputation points',
        timestamp: Date.now() - 45000,
        icon: TrendingUp,
        color: 'text-green-500'
    },
    {
        id: '3',
        type: 'levelup',
        user: 'NFTCollector',
        message: 'reached level 7 in Digital Art',
        timestamp: Date.now() - 60000,
        icon: Star,
        color: 'text-purple-500'
    },
    {
        id: '4',
        type: 'identity',
        user: 'SomniaDevs',
        message: 'created their SomniaID identity',
        timestamp: Date.now() - 90000,
        icon: Zap,
        color: 'text-blue-500'
    }
]

export function LiveFeed() {
    const [feedItems, setFeedItems] = useState<FeedItem[]>(mockFeedData)

    // Simulate real-time updates
    useEffect(() => {
        const interval = setInterval(() => {
            const newItem: FeedItem = {
                id: Date.now().toString(),
                type: ['reputation', 'achievement', 'levelup', 'identity'][Math.floor(Math.random() * 4)] as any,
                user: ['DevMaster', 'CryptoGuru', 'BlockchainPro', 'SomniaFan'][Math.floor(Math.random() * 4)],
                message: [
                    'gained +25 reputation points',
                    'unlocked "Code Warrior" achievement',
                    'reached level 5 in Development',
                    'created their SomniaID identity'
                ][Math.floor(Math.random() * 4)],
                timestamp: Date.now(),
                icon: [TrendingUp, Trophy, Star, Zap][Math.floor(Math.random() * 4)],
                color: ['text-green-500', 'text-yellow-500', 'text-purple-500', 'text-blue-500'][Math.floor(Math.random() * 4)]
            }

            setFeedItems(prev => [newItem, ...prev.slice(0, 7)])
        }, 5000)

        return () => clearInterval(interval)
    }, [])

    const formatTimeAgo = (timestamp: number) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000)
        if (seconds < 60) return `${seconds}s ago`
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) return `${minutes}m ago`
        const hours = Math.floor(minutes / 60)
        return `${hours}h ago`
    }

    return (
        <section className="py-24 bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-center mb-12"
                >
                    <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                        Live Activity Feed
                    </h2>
                    <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                        Watch reputation updates happen in real-time across the Somnia Network
                    </p>
                </motion.div>

                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-3xl shadow-2xl p-8">
                        {/* Feed Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                                <span className="font-semibold text-gray-900">Live Updates</span>
                            </div>
                            <div className="text-sm text-gray-500">
                                Powered by Somnia's sub-second finality
                            </div>
                        </div>

                        {/* Feed Items */}
                        <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                            {feedItems.map((item, index) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="flex items-start space-x-4 p-4 rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    <div className={`p-2 rounded-lg bg-gray-100 ${item.color}`}>
                                        <item.icon className="w-5 h-5" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-2">
                                            <span className="font-semibold text-gray-900">{item.user}</span>
                                            <span className="text-gray-600">{item.message}</span>
                                        </div>
                                        <div className="text-sm text-gray-400 mt-1">
                                            {formatTimeAgo(item.timestamp)}
                                        </div>
                                    </div>

                                    {/* New indicator for recent items */}
                                    {index === 0 && (
                                        <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                                            New
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>

                        {/* Feed Footer */}
                        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                            <p className="text-gray-600 text-sm">
                                Join the network to see your updates here in real-time! ⚡
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
        </section>
    )
}