'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, TrendingUp, Users, Star, Trophy, MapPin, Calendar, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/utils/api'
import toast from 'react-hot-toast'

interface Identity {
    tokenId: number
    username: string
    primarySkill: string
    experience: string
    reputationScore: number
    skillLevel: number
    achievementCount: number
    isVerified: boolean
    currentPrice: number
    profile?: {
        bio?: string
        skills?: string[]
        achievements?: any[]
        goals?: any[]
        socialLinks?: any
    }
    ownerAddress: string
    txHash?: string
}

export default function ExplorePage() {
    const [identities, setIdentities] = useState<Identity[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')

    useEffect(() => {
        loadIdentities()
    }, [])

    const loadIdentities = async () => {
        try {
            setLoading(true)
            const response = await api.getIdentities(1, 20)

            if (response.success && response.identities?.length > 0) {
                setIdentities(response.identities)
            } else {
                // Only show demo data if no real data exists
                setIdentities([])
                toast('No identities created yet. Be the first!')
            }
        } catch (error) {
            console.error('Error loading identities:', error)
            setIdentities([])
            toast.error('Failed to load identities')
        } finally {
            setLoading(false)
        }
    }

    const filteredIdentities = identities.filter(identity => {
        const matchesSearch = identity.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
            identity.primarySkill.toLowerCase().includes(searchQuery.toLowerCase())

        if (filter === 'verified') return matchesSearch && identity.isVerified
        if (filter === 'top') return matchesSearch && identity.reputationScore > 200
        return matchesSearch
    })

    if (loading) {
        return (
            <div className="min-h-screen pt-20 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Discovering identities...</p>
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
                        Explore <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Identities</span>
                    </h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Discover talented individuals building on Somnia Network
                    </p>
                </motion.div>

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

                    <div className="flex items-center space-x-2">
                        <Filter className="w-5 h-5 text-gray-400" />
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="all">All Identities</option>
                            <option value="verified">Verified Only</option>
                            <option value="top">Top Performers</option>
                        </select>
                    </div>
                </div>

                {filteredIdentities.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-16"
                    >
                        <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">
                            {identities.length === 0 ? 'No identities created yet' : 'No results found'}
                        </h3>
                        <p className="text-gray-500 mb-6">
                            {identities.length === 0 ? 'Be the first to create a SomniaID!' : 'Try adjusting your search or filters'}
                        </p>
                        {identities.length === 0 && (
                            <Link
                                href="/dashboard"
                                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300"
                            >
                                Create Your Identity
                            </Link>
                        )}
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredIdentities.map((identity, index) => (
                            <motion.div
                                key={identity.tokenId}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow"
                            >
                                <Link href={`/profile/${identity.tokenId}`}>
                                    <div className="flex items-center space-x-4 mb-4">
                                        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center">
                                            <span className="text-white font-bold text-xl">
                                                {identity.username.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2">
                                                <h3 className="text-lg font-bold text-gray-900">{identity.username}</h3>
                                                {identity.isVerified && (
                                                    <span className="text-green-600">✓</span>
                                                )}
                                            </div>
                                            <p className="text-gray-600">{identity.primarySkill}</p>
                                            <p className="text-sm text-gray-500 capitalize">{identity.experience} level</p>
                                        </div>
                                    </div>

                                    {identity.profile?.bio && (
                                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                                            {identity.profile.bio}
                                        </p>
                                    )}

                                    {identity.profile?.skills && identity.profile.skills.length > 0 && (
                                        <div className="mb-4">
                                            <div className="flex flex-wrap gap-1">
                                                {identity.profile.skills.slice(0, 3).map((skill, skillIndex) => (
                                                    <span
                                                        key={skillIndex}
                                                        className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded"
                                                    >
                                                        {skill}
                                                    </span>
                                                ))}
                                                {identity.profile.skills.length > 3 && (
                                                    <span className="text-xs text-gray-500">
                                                        +{identity.profile.skills.length - 3} more
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-3 gap-3 text-center mb-4">
                                        <div>
                                            <div className="text-lg font-bold text-blue-600">{identity.reputationScore}</div>
                                            <div className="text-xs text-gray-500">Reputation</div>
                                        </div>
                                        <div>
                                            <div className="text-lg font-bold text-yellow-600">{identity.achievementCount}</div>
                                            <div className="text-xs text-gray-500">Achievements</div>
                                        </div>
                                        <div>
                                            <div className="text-lg font-bold text-green-600">{identity.currentPrice} STT</div>
                                            <div className="text-xs text-gray-500">NFT Value</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-sm text-gray-500">
                                        <div className="flex items-center space-x-1">
                                            <Star className="w-3 h-3" />
                                            <span>Level {identity.skillLevel}</span>
                                        </div>
                                        {identity.txHash && (
                                            <a
                                                href={`https://shannon-explorer.somnia.network/tx/${identity.txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center space-x-1 text-blue-600 hover:text-blue-700"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                <span>TX</span>
                                            </a>
                                        )}
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}