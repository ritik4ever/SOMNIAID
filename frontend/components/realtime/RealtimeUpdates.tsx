'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { io, Socket } from 'socket.io-client'
import { Trophy, TrendingUp, Users, Zap, Bell, X } from 'lucide-react'
import { useAccount } from 'wagmi'
import toast from 'react-hot-toast'

interface RealtimeNotification {
    id: string
    type: 'achievement' | 'reputation' | 'identity_created' | 'global'
    title: string
    message: string
    data?: any
    timestamp: Date
    read: boolean
}

interface ReputationUpdate {
    tokenId: number
    oldScore: number
    newScore: number
    reason: string
    timestamp: Date
}

export default function RealtimeUpdates() {
    const [socket, setSocket] = useState<Socket | null>(null)
    const [notifications, setNotifications] = useState<RealtimeNotification[]>([])
    const [isConnected, setIsConnected] = useState(false)
    const [showNotifications, setShowNotifications] = useState(false)
    const [realtimeStats, setRealtimeStats] = useState<any>(null)
    const { address } = useAccount()

    useEffect(() => {
        // Initialize Socket.IO connection
        const socketInstance = io('http://localhost:5000', {
            transports: ['websocket']
        })

        socketInstance.on('connect', () => {
            setIsConnected(true)
            console.log('🔗 Connected to real-time updates')

            // Join user-specific room if connected
            if (address) {
                socketInstance.emit('join_user', address)
            }

            // Subscribe to global events
            socketInstance.emit('track_leaderboard')
        })

        socketInstance.on('disconnect', () => {
            setIsConnected(false)
            console.log('❌ Disconnected from real-time updates')
        })

        // Listen for reputation updates
        socketInstance.on('reputation_updated', (update: ReputationUpdate) => {
            const notification: RealtimeNotification = {
                id: `rep_${Date.now()}`,
                type: 'reputation',
                title: 'Reputation Updated!',
                message: `Your reputation increased by ${update.newScore - update.oldScore} points (${update.reason})`,
                data: update,
                timestamp: new Date(),
                read: false
            }

            addNotification(notification)

            // Show toast for current user
            if (update.tokenId && address) {
                toast.success(`🚀 +${update.newScore - update.oldScore} reputation points!`)
            }
        })

        // Listen for achievement unlocks
        socketInstance.on('achievement_unlocked', (data: any) => {
            const notification: RealtimeNotification = {
                id: `ach_${Date.now()}`,
                type: 'achievement',
                title: 'Achievement Unlocked!',
                message: `You unlocked: ${data.achievement.title}`,
                data,
                timestamp: new Date(),
                read: false
            }

            addNotification(notification)

            // Show confetti and toast
            toast.success(`🏆 Achievement: ${data.achievement.title}!`, {
                duration: 5000,
                style: {
                    background: 'linear-gradient(45deg, #f59e0b, #d97706)',
                    color: 'white'
                }
            })
        })

        // Listen for global achievements
        socketInstance.on('global_achievement', (data: any) => {
            const notification: RealtimeNotification = {
                id: `global_${Date.now()}`,
                type: 'global',
                title: 'Global Achievement',
                message: `${data.username} unlocked: ${data.achievement}`,
                data,
                timestamp: new Date(),
                read: false
            }

            addNotification(notification)
        })

        // Listen for new identity creations
        socketInstance.on('identity_created', (data: any) => {
            const notification: RealtimeNotification = {
                id: `identity_${Date.now()}`,
                type: 'identity_created',
                title: 'New User Joined!',
                message: `${data.username} just created their SomniaID`,
                data,
                timestamp: new Date(),
                read: false
            }

            addNotification(notification)
        })

        // Listen for leaderboard updates
        socketInstance.on('leaderboard_updated', (data: any) => {
            console.log('📊 Leaderboard updated:', data.length, 'users')
        })

        // Listen for real-time stats
        socketInstance.on('realtime_stats', (stats: any) => {
            setRealtimeStats(stats)
        })

        // Listen for live activity
        socketInstance.on('live_activity', (activity: any) => {
            console.log('🔴 Live activity:', activity)
        })

        setSocket(socketInstance)

        return () => {
            socketInstance.disconnect()
        }
    }, [address])

    const addNotification = (notification: RealtimeNotification) => {
        setNotifications(prev => [notification, ...prev].slice(0, 20)) // Keep only last 20
    }

    const markAsRead = (id: string) => {
        setNotifications(prev =>
            prev.map(notif =>
                notif.id === id ? { ...notif, read: true } : notif
            )
        )
    }

    const clearAllNotifications = () => {
        setNotifications([])
        setShowNotifications(false)
    }

    const unreadCount = notifications.filter(n => !n.read).length

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'achievement': return Trophy
            case 'reputation': return TrendingUp
            case 'identity_created': return Users
            case 'global': return Zap
            default: return Bell
        }
    }

    const getNotificationColor = (type: string) => {
        switch (type) {
            case 'achievement': return 'bg-yellow-100 text-yellow-600'
            case 'reputation': return 'bg-purple-100 text-purple-600'
            case 'identity_created': return 'bg-blue-100 text-blue-600'
            case 'global': return 'bg-green-100 text-green-600'
            default: return 'bg-gray-100 text-gray-600'
        }
    }

    return (
        <div className="relative">
            {/* Connection Status */}
            <div className={`fixed top-4 right-4 z-50 px-3 py-1 rounded-full text-xs font-medium transition-all ${isConnected
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
                }`}>
                <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-600 animate-pulse' : 'bg-red-600'
                        }`} />
                    <span>{isConnected ? 'Live' : 'Offline'}</span>
                </div>
            </div>

            {/* Notification Bell */}
            <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
                <Bell className="w-6 h-6 text-gray-600" />
                {unreadCount > 0 && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center"
                    >
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.div>
                )}
            </button>

            {/* Notifications Panel */}
            <AnimatePresence>
                {showNotifications && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 bg-black/20 z-40"
                            onClick={() => setShowNotifications(false)}
                        />

                        {/* Panel */}
                        <motion.div
                            initial={{ opacity: 0, x: 300 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 300 }}
                            className="fixed top-16 right-4 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 max-h-96 overflow-hidden"
                        >
                            {/* Header */}
                            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="font-semibold text-gray-900">Live Updates</h3>
                                <div className="flex items-center space-x-2">
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={clearAllNotifications}
                                            className="text-xs text-blue-600 hover:text-blue-700"
                                        >
                                            Clear all
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowNotifications(false)}
                                        className="p-1 hover:bg-gray-100 rounded"
                                    >
                                        <X className="w-4 h-4 text-gray-500" />
                                    </button>
                                </div>
                            </div>

                            {/* Notifications List */}
                            <div className="max-h-80 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="p-6 text-center text-gray-500">
                                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p>No notifications yet</p>
                                        <p className="text-xs mt-1">You'll see live updates here</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100">
                                        {notifications.map((notification, index) => {
                                            const Icon = getNotificationIcon(notification.type)
                                            return (
                                                <motion.div
                                                    key={notification.id}
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    onClick={() => markAsRead(notification.id)}
                                                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${!notification.read ? 'bg-blue-50/50' : ''
                                                        }`}
                                                >
                                                    <div className="flex items-start space-x-3">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getNotificationColor(notification.type)
                                                            }`}>
                                                            <Icon className="w-4 h-4" />
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between">
                                                                <p className="font-medium text-sm text-gray-900 truncate">
                                                                    {notification.title}
                                                                </p>
                                                                {!notification.read && (
                                                                    <div className="w-2 h-2 bg-blue-600 rounded-full ml-2" />
                                                                )}
                                                            </div>

                                                            <p className="text-sm text-gray-600 mt-1">
                                                                {notification.message}
                                                            </p>

                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {Math.floor((Date.now() - notification.timestamp.getTime()) / 1000)}s ago
                                                            </p>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Footer with Stats */}
                            {realtimeStats && (
                                <div className="p-3 bg-gray-50 border-t border-gray-100">
                                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                        <div>
                                            <div className="font-semibold text-blue-600">{realtimeStats.activeUsers}</div>
                                            <div className="text-gray-500">Online</div>
                                        </div>
                                        <div>
                                            <div className="font-semibold text-green-600">{realtimeStats.totalUsers}</div>
                                            <div className="text-gray-500">Total Users</div>
                                        </div>
                                        <div>
                                            <div className="font-semibold text-purple-600">
                                                {realtimeStats.totalAchievements?.[0]?.total || 0}
                                            </div>
                                            <div className="text-gray-500">Achievements</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Achievement Animation Overlay */}
            <AnimatePresence>
                {notifications.some(n => n.type === 'achievement' && !n.read) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 pointer-events-none z-30"
                    >
                        {/* Confetti or celebration effect would go here */}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}