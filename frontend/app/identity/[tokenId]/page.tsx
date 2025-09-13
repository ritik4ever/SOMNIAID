'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Star, Trophy, Calendar, ExternalLink, Share2 } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/utils/api'
import { Identity, Achievement } from '@/types'
import toast from 'react-hot-toast'

// ✅ Define API response types
type IdentityResponse = {
    success: boolean
    identity: Identity
}

type AchievementsResponse = {
    success: boolean
    achievements: Achievement[]
}

export default function IdentityPage() {
    const params = useParams()
    const rawTokenId = params?.tokenId
    const tokenId = Array.isArray(rawTokenId) ? rawTokenId[0] : rawTokenId

    const [identity, setIdentity] = useState<Identity | null>(null)
    const [achievements, setAchievements] = useState<Achievement[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (tokenId) {
            loadIdentityData()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokenId])

    const loadIdentityData = async () => {
        if (!tokenId) return

        try {
            const numericTokenId = parseInt(tokenId)

            // ✅ Fix: Cast Promise.all result to correct tuple type
            const [identityResponse, achievementsResponse] =
                (await Promise.all([
                    api.getIdentity(numericTokenId),
                    api.getAchievements(numericTokenId),
                ])) as [IdentityResponse, AchievementsResponse]

            if (identityResponse.success) {
                setIdentity(identityResponse.identity)
            }

            if (achievementsResponse.success) {
                setAchievements(achievementsResponse.achievements)
            }
        } catch (error) {
            toast.error('Failed to load identity data')
        } finally {
            setLoading(false)
        }
    }

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href)
        toast.success('Link copied to clipboard!')
    }

    const getReputationColor = (score: number) => {
        if (score >= 800) return 'from-green-400 to-emerald-500'
        if (score >= 600) return 'from-blue-400 to-indigo-500'
        if (score >= 400) return 'from-yellow-400 to-orange-500'
        return 'from-purple-400 to-pink-500'
    }

    if (loading) {
        return (
            <div className="min-h-screen pt-20 bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading identity...</p>
                    </div>
                </div>
            </div>
        )
    }

    if (!identity) {
        return (
            <div className="min-h-screen pt-20 bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold text-gray-900 mb-4">Identity Not Found</h1>
                        <p className="text-gray-600 mb-8">The identity you're looking for doesn't exist.</p>
                        <Link
                            href="/explore"
                            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-4 rounded-xl font-semibold hover:shadow-lg transition-all duration-300"
                        >
                            Browse Identities
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen pt-20 bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Back Button */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="mb-8"
                >
                    <Link
                        href="/explore"
                        className="inline-flex items-center space-x-2 text-purple-600 hover:text-purple-700 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-medium">Back to Explore</span>
                    </Link>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Profile + Achievements */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Main Profile Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="nft-card rounded-3xl p-8"
                        >
                            {/* Header */}
                            <div className="flex flex-col md:flex-row items-start justify-between mb-8">
                                <div className="flex items-center space-x-6 mb-4 md:mb-0">
                                    <div className="w-24 h-24 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center">
                                        <span className="text-white font-bold text-3xl">
                                            {identity.username?.charAt(0) || '#'}
                                        </span>
                                    </div>
                                    <div>
                                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                            {identity.username || `Identity #${identity.tokenId}`}
                                        </h1>
                                        <p className="text-xl text-gray-600 mb-2">{identity.primarySkill}</p>
                                        <div className="flex items-center space-x-4">
                                            <div className="flex items-center space-x-1">
                                                <Star className="w-5 h-5 text-purple-500" />
                                                <span className="font-semibold text-gray-700">
                                                    Level {identity.skillLevel}
                                                </span>
                                            </div>
                                            {identity.isVerified && (
                                                <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                                                    ✓ Verified
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleShare}
                                    className="flex items-center space-x-2 bg-purple-100 text-purple-600 px-4 py-2 rounded-xl hover:bg-purple-200 transition-colors"
                                >
                                    <Share2 className="w-4 h-4" />
                                    <span>Share</span>
                                </button>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl">
                                    <div
                                        className={`text-4xl font-bold bg-gradient-to-r ${getReputationColor(
                                            parseInt(identity.reputationScore.toString())
                                        )} bg-clip-text text-transparent mb-2`}
                                    >
                                        {identity.reputationScore.toString()}
                                    </div>
                                    <div className="text-gray-600 font-medium">Reputation Score</div>
                                </div>
                                <div className="text-center p-6 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl">
                                    <div className="text-4xl font-bold text-yellow-600 mb-2">
                                        {identity.achievementCount.toString()}
                                    </div>
                                    <div className="text-gray-600 font-medium">Achievements</div>
                                </div>
                                <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl">
                                    <div className="text-4xl font-bold text-green-600 mb-2">
                                        {identity.skillLevel.toString()}
                                    </div>
                                    <div className="text-gray-600 font-medium">Skill Level</div>
                                </div>
                            </div>

                            {/* Bio */}
                            {identity.profile?.bio && (
                                <div className="mb-8">
                                    <h2 className="text-xl font-bold text-gray-900 mb-4">About</h2>
                                    <p className="text-gray-600 leading-relaxed">{identity.profile.bio}</p>
                                </div>
                            )}

                            {/* Skills */}
                            {identity.profile?.skills && identity.profile.skills.length > 0 && (
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 mb-4">Skills</h2>
                                    <div className="flex flex-wrap gap-2">
                                        {identity.profile.skills.map((skill, idx) => (
                                            <span
                                                key={idx}
                                                className="bg-purple-100 text-purple-700 px-4 py-2 rounded-full font-medium"
                                            >
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>

                        {/* Achievements Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="nft-card rounded-3xl p-8"
                        >
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">Achievements</h2>

                            {achievements.length === 0 ? (
                                <div className="text-center py-12">
                                    <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-500">No achievements yet</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {achievements.map((achievement, idx) => (
                                        <div
                                            key={idx}
                                            className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-6 border border-yellow-200"
                                        >
                                            <div className="flex items-start space-x-4">
                                                <div className="text-3xl">🏆</div>
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-gray-900 mb-2">
                                                        {achievement.title}
                                                    </h3>
                                                    <p className="text-sm text-gray-600 mb-3">
                                                        {achievement.description}
                                                    </p>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center space-x-1 text-yellow-700">
                                                            <Star className="w-4 h-4" />
                                                            <span className="font-semibold">
                                                                {achievement.points} points
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center space-x-1 text-gray-500 text-xs">
                                                            <Calendar className="w-3 h-3" />
                                                            <span>
                                                                {new Date(achievement.timestamp).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-8">
                        {/* NFT Details Card */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="nft-card rounded-3xl p-6"
                        >
                            <h3 className="text-lg font-bold text-gray-900 mb-4">NFT Details</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Token ID</span>
                                    <span className="font-semibold">#{identity.tokenId}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Network</span>
                                    <span className="font-semibold">Somnia</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Last Update</span>
                                    <span className="font-semibold">
                                        {new Date(parseInt(identity.lastUpdate.toString()) * 1000).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <a
                                    href={`https://shannon-explorer.somnia.network/token/${identity.tokenId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 transition-colors"
                                >
                                    <span>View on Explorer</span>
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>
                        </motion.div>

                        {/* Social Links Card */}
                        {identity.profile?.socialLinks && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                                className="nft-card rounded-3xl p-6"
                            >
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Connect</h3>
                                <div className="space-y-3">
                                    {identity.profile.socialLinks.twitter && (
                                        <a
                                            href={`https://twitter.com/${identity.profile.socialLinks.twitter}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center space-x-3 p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
                                        >
                                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
                                                𝕏
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-900">Twitter</div>
                                                <div className="text-sm text-gray-600">
                                                    @{identity.profile.socialLinks.twitter}
                                                </div>
                                            </div>
                                        </a>
                                    )}

                                    {identity.profile.socialLinks.github && (
                                        <a
                                            href={`https://github.com/${identity.profile.socialLinks.github}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                                        >
                                            <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-white">
                                                ⚡
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-900">GitHub</div>
                                                <div className="text-sm text-gray-600">
                                                    {identity.profile.socialLinks.github}
                                                </div>
                                            </div>
                                        </a>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
