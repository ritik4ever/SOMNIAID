'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    TrendingUp, Users, Trophy, Zap, Activity,
    Eye, Clock, Star, ArrowUp, ArrowDown
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface AnalyticsData {
    totalUsers: number
    totalAchievements: number
    avgReputation: number
    activeUsers: number
    reputationGrowth: number
    achievementGrowth: number
    userGrowth: number
    topSkills: Array<{ skill: string; count: number }>
    recentActivities: Array<{
        type: string
        username: string
        action: string
        timestamp: Date
    }>
    reputationDistribution: Array<{ range: string; count: number }>
    hourlyActivity: Array<{ hour: number; users: number; achievements: number }>
}

export default function LiveAnalytics() {
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [realtimeUpdates, setRealtimeUpdates] = useState(0)

    useEffect(() => {
        loadAnalytics()

        // Simulate real-time updates
        const interval = setInterval(() => {
            setRealtimeUpdates(prev => prev + 1)
            updateRealtimeData()
        }, 5000)

        return () => clearInterval(interval)
    }, [])

    const loadAnalytics = async () => {
        try {
            setLoading(true)
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000))

            // Mock analytics data
            setAnalytics({
                totalUsers: 1247 + Math.floor(Math.random() * 10),
                totalAchievements: 15683 + Math.floor(Math.random() * 50),
                avgReputation: 342 + Math.floor(Math.random() * 20),
                activeUsers: 89 + Math.floor(Math.random() * 20),
                reputationGrowth: 12.5 + Math.random() * 5,
                achievementGrowth: 8.3 + Math.random() * 3,
                userGrowth: 23.1 + Math.random() * 10,
                topSkills: [
                    { skill: 'Smart Contract Development', count: 234 },
                    { skill: 'DeFi Protocol Design', count: 189 },
                    { skill: 'Frontend Development', count: 167 },
                    { skill: 'Blockchain Architecture', count: 143 },
                    { skill: 'NFT Creation', count: 128 }
                ],
                recentActivities: [
                    { type: 'achievement', username: 'alice.eth', action: 'unlocked Hackathon Champion', timestamp: new Date() },
                    { type: 'reputation', username: 'bob.dev', action: 'gained 50 reputation points', timestamp: new Date(Date.now() - 60000) },
                    { type: 'identity', username: 'charlie.som', action: 'created SomniaID', timestamp: new Date(Date.now() - 120000) },
                    { type: 'achievement', username: 'diana.web3', action: 'unlocked Expert Builder', timestamp: new Date(Date.now() - 180000) }
                ],
                reputationDistribution: [
                    { range: '0-100', count: 423 },
                    { range: '100-500', count: 487 },
                    { range: '500-1000', count: 234 },
                    { range: '1000-2500', count: 87 },
                    { range: '2500+', count: 16 }
                ],
                hourlyActivity: Array.from({ length: 24 }, (_, i) => ({
                    hour: i,
                    users: Math.floor(Math.random() * 100) + 20,
                    achievements: Math.floor(Math.random() * 50) + 5
                }))
            })
        } catch (error) {
            console.error('Error loading analytics:', error)
        } finally {
            setLoading(false)
        }
    }

    const updateRealtimeData = () => {
        if (!analytics) return

        setAnalytics(prev => ({
            ...prev!,
            totalUsers: prev!.totalUsers + Math.floor(Math.random() * 3),
            totalAchievements: prev!.totalAchievements + Math.floor(Math.random() * 5),
            activeUsers: Math.max(50, prev!.activeUsers + Math.floor(Math.random() * 10) - 5),
            recentActivities: [
                {
                    type: 'live',
                    username: `user_${Math.floor(Math.random() * 1000)}`,
                    action: 'live activity update',
                    timestamp: new Date()
                },
                ...prev!.recentActivities.slice(0, 9)
            ]
        }))
    }

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

    if (loading) {
        return (
            <div className="p-8">
                <div className="flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <span className="ml-3 text-gray-600">Loading analytics...</span>
                </div>
            </div>
        )
    }

    if (!analytics) {
        return (
            <div className="p-8 text-center text-gray-500">
                Failed to load analytics data
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900">Live Analytics</h1>
                <div className="flex items-center space-x-2 text-sm text-green-600">
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                    <span>Live Data • Updated {realtimeUpdates} times</span>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Total Users"
                    value={analytics.totalUsers.toLocaleString()}
                    change={analytics.userGrowth}
                    icon={Users}
                    color="blue"
                />
                <MetricCard
                    title="Achievements Unlocked"
                    value={analytics.totalAchievements.toLocaleString()}
                    change={analytics.achievementGrowth}
                    icon={Trophy}
                    color="yellow"
                />
                <MetricCard
                    title="Average Reputation"
                    value={analytics.avgReputation.toString()}
                    change={analytics.reputationGrowth}
                    icon={Star}
                    color="purple"
                />
                <MetricCard
                    title="Active Now"
                    value={analytics.activeUsers.toString()}
                    change={0}
                    icon={Activity}
                    color="green"
                    isLive
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hourly Activity */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                >
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        24-Hour Activity
                    </h2>
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={analytics.hourlyActivity}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="hour" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={2} />
                            <Line type="monotone" dataKey="achievements" stroke="#10b981" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </motion.div>

                {/* Reputation Distribution */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                >
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        Reputation Distribution
                    </h2>
                    <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                            <Pie
                                data={analytics.reputationDistribution}
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="count"
                                label={({ range }) => range}
                            >
                                {analytics.reputationDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </motion.div>
            </div>

            {/* Top Skills & Live Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Skills */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                >
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        Top Skills
                    </h2>
                    <div className="space-y-3">
                        {analytics.topSkills.map((skill, index) => (
                            <div key={skill.skill} className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${index === 0 ? 'bg-yellow-500' :
                                        index === 1 ? 'bg-gray-400' :
                                            index === 2 ? 'bg-orange-600' : 'bg-blue-500'
                                        }`}>
                                        {index + 1}
                                    </div>
                                    <span className="text-gray-900">{skill.skill}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="w-20 bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full"
                                            style={{ width: `${(skill.count / analytics.topSkills[0].count) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-sm text-gray-600 w-8 text-right">{skill.count}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Live Activity Feed */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">
                            Live Activity Feed
                        </h2>
                        <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                    </div>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                        {analytics.recentActivities.map((activity, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activity.type === 'achievement' ? 'bg-yellow-100 text-yellow-600' :
                                    activity.type === 'reputation' ? 'bg-purple-100 text-purple-600' :
                                        activity.type === 'identity' ? 'bg-blue-100 text-blue-600' :
                                            'bg-green-100 text-green-600'
                                    }`}>
                                    {activity.type === 'achievement' ? <Trophy className="w-4 h-4" /> :
                                        activity.type === 'reputation' ? <TrendingUp className="w-4 h-4" /> :
                                            activity.type === 'identity' ? <Users className="w-4 h-4" /> :
                                                <Activity className="w-4 h-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm">
                                        <span className="font-medium text-gray-900">{activity.username}</span>
                                        <span className="text-gray-600"> {activity.action}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 flex items-center mt-1">
                                        <Clock className="w-3 h-3 mr-1" />
                                        {Math.floor((Date.now() - activity.timestamp.getTime()) / 1000)}s ago
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Real-time Stats Bar */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white"
            >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                        <div className="text-2xl font-bold">{(analytics.totalUsers * 0.07).toFixed(0)}</div>
                        <div className="text-sm opacity-90">Online Now</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold">{(analytics.totalAchievements / 24).toFixed(0)}</div>
                        <div className="text-sm opacity-90">Achievements/Hour</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold">{(analytics.avgReputation * 1.15).toFixed(0)}</div>
                        <div className="text-sm opacity-90">Peak Reputation</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold">99.8%</div>
                        <div className="text-sm opacity-90">Uptime</div>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}

interface MetricCardProps {
    title: string
    value: string
    change: number
    icon: any
    color: 'blue' | 'yellow' | 'purple' | 'green'
    isLive?: boolean
}

function MetricCard({ title, value, change, icon: Icon, color, isLive }: MetricCardProps) {
    const colors = {
        blue: 'bg-blue-100 text-blue-600',
        yellow: 'bg-yellow-100 text-yellow-600',
        purple: 'bg-purple-100 text-purple-600',
        green: 'bg-green-100 text-green-600'
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
            <div className="flex items-center justify-between">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colors[color]}`}>
                    <Icon className="w-6 h-6" />
                </div>
                {isLive && (
                    <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                )}
            </div>

            <div className="mt-4">
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-sm text-gray-600">{title}</div>
            </div>

            {change > 0 && !isLive && (
                <div className="mt-2 flex items-center text-green-600 text-sm">
                    <ArrowUp className="w-4 h-4 mr-1" />
                    <span>+{change.toFixed(1)}% from last week</span>
                </div>
            )}
        </motion.div>
    )
}