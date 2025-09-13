'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    TrendingUp,
    Trophy,
    Star,
    Zap,
    Activity,
    Clock,
    ArrowUp,
    ArrowDown,
    Target
} from 'lucide-react'

interface ActivityItem {
    id: string
    type: 'level_up' | 'reputation_gain' | 'achievement' | 'skill_update'
    user: string
    action: string
    value?: number
    timestamp: string
    isNew?: boolean
}

export function ActivityFeed() {
    const [activities, setActivities] = useState<ActivityItem[]>([
        {
            id: '1',
            type: 'level_up',
            user: 'BlockchainPro',
            action: 'reached level 5 in Development',
            timestamp: '2m ago',
            isNew: true
        },
        {
            id: '2',
            type: 'reputation_gain',
            user: 'CryptoGuru',
            action: 'gained reputation points',
            value: 25,
            timestamp: '5m ago'
        },
        {
            id: '3',
            type: 'achievement',
            user: 'DevMaster',
            action: 'unlocked "Code Warrior" achievement',
            value: 50,
            timestamp: '8m ago'
        },
        {
            id: '4',
            type: 'reputation_gain',
            user: 'SmartContractDev',
            action: 'gained reputation points',
            value: 15,
            timestamp: '12m ago'
        },
        {
            id: '5',
            type: 'skill_update',
            user: 'DeFiExpert',
            action: 'updated skill profile',
            timestamp: '15m ago'
        }
    ])

    const [liveStatus, setLiveStatus] = useState(true)

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'level_up':
                return <TrendingUp className="w-4 h-4 text-blue-600" />
            case 'reputation_gain':
                return <ArrowUp className="w-4 h-4 text-green-600" />
            case 'achievement':
                return <Trophy className="w-4 h-4 text-yellow-600" />
            case 'skill_update':
                return <Target className="w-4 h-4 text-purple-600" />
            default:
                return <Activity className="w-4 h-4 text-gray-600" />
        }
    }

    const getActivityColor = (type: string) => {
        switch (type) {
            case 'level_up':
                return 'border-l-blue-500 bg-blue-50'
            case 'reputation_gain':
                return 'border-l-green-500 bg-green-50'
            case 'achievement':
                return 'border-l-yellow-500 bg-yellow-50'
            case 'skill_update':
                return 'border-l-purple-500 bg-purple-50'
            default:
                return 'border-l-gray-500 bg-gray-50'
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
            {/* Header */}
            <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-gray-900">Live Activity Feed</h3>
                    <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${liveStatus ? 'bg-green-500' : 'bg-gray-400'} animate-pulse`}></div>
                        <span className="text-sm text-gray-600">
                            {liveStatus ? 'Live' : 'Offline'}
                        </span>
                    </div>
                </div>
                <p className="text-sm text-gray-600">
                    Real-time updates across the Somnia Network
                </p>
            </div>

            {/* Activity List */}
            <div className="max-h-96 overflow-y-auto">
                <AnimatePresence>
                    {activities.map((activity, index) => (
                        <motion.div
                            key={activity.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ delay: index * 0.1 }}
                            className={`p-4 border-l-4 hover:bg-gray-50 transition-colors ${getActivityColor(activity.type)} ${activity.isNew ? 'animate-pulse' : ''
                                }`}
                        >
                            <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 mt-1">
                                    {getActivityIcon(activity.type)}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-gray-900">
                                            {activity.user}
                                        </p>
                                        {activity.isNew && (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                New
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-sm text-gray-600 mt-1">
                                        {activity.action}
                                        {activity.value && (
                                            <span className="font-semibold text-gray-900 ml-1">
                                                +{activity.value}
                                            </span>
                                        )}
                                    </p>

                                    <div className="flex items-center mt-2 text-xs text-gray-500">
                                        <Clock className="w-3 h-3 mr-1" />
                                        {activity.timestamp}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100">
                <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">
                        Powered by Somnia's sub-second finality
                    </p>
                    <button className="text-blue-600 text-sm font-medium hover:text-blue-700 transition-colors">
                        Join the network to see your updates here 🚀
                    </button>
                </div>
            </div>
        </motion.div>
    )
}