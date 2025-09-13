'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    ArrowLeft, MapPin, Calendar, ExternalLink, Trophy, Target,
    Star, TrendingUp, Users, Award, Zap, CheckCircle
} from 'lucide-react'
import Link from 'next/link'
import { api } from '@/utils/api'
import toast from 'react-hot-toast'

export default function ProfilePage() {
    const params = useParams()
    const [identity, setIdentity] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (params?.tokenId) {
            loadProfile()
        }
    }, [params?.tokenId])

    const loadProfile = async () => {
        try {
            setLoading(true)
            const response = await api.getIdentity(Number(params?.tokenId))

            if (response.success && response.data) {
                setIdentity(response.data)
            } else {
                toast.error('Profile not found')
            }
        } catch (error) {
            toast.error('Failed to load profile')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen pt-20 bg-gray-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading profile...</p>
                    </div>
                </div>
            </div>
        )
    }

    if (!identity) {
        return (
            <div className="min-h-screen pt-20 bg-gray-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h1>
                    <Link href="/explore" className="text-blue-600 hover:text-blue-700">
                        ← Back to Explore
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen pt-20 bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Back Button */}
                <Link
                    href="/explore"
                    className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Explore
                </Link>

                {/* Profile Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 mb-8"
                >
                    <div className="flex items-start space-x-6">
                        <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center">
                            <span className="text-white font-bold text-3xl">
                                {identity.username.charAt(0).toUpperCase()}
                            </span>
                        </div>

                        <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                                <h1 className="text-3xl font-bold text-gray-900">{identity.username}</h1>
                                {identity.isVerified && (
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                )}
                            </div>

                            <p className="text-xl text-gray-600 mb-3">{identity.primarySkill}</p>
                            <p className="text-gray-600 capitalize mb-4">{identity.experience} Level Developer</p>

                            {identity.profile?.bio && (
                                <p className="text-gray-700 leading-relaxed mb-4">{identity.profile.bio}</p>
                            )}

                            <div className="grid grid-cols-4 gap-4 mb-4">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-blue-600">{identity.reputationScore}</div>
                                    <div className="text-sm text-gray-500">Reputation</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-yellow-600">{identity.achievementCount}</div>
                                    <div className="text-sm text-gray-500">Achievements</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-green-600">{identity.skillLevel}</div>
                                    <div className="text-sm text-gray-500">Level</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-purple-600">{identity.currentPrice} STT</div>
                                    <div className="text-sm text-gray-500">NFT Value</div>
                                </div>
                            </div>

                            {identity.txHash && (
                                <a
                                    href={`https://shannon-explorer.somnia.network/tx/${identity.txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm"
                                >
                                    <ExternalLink className="w-4 h-4 mr-1" />
                                    View on Blockchain
                                </a>
                            )}
                        </div>
                    </div>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Skills */}
                        {identity.profile?.skills && identity.profile.skills.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                            >
                                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                                    <Zap className="w-5 h-5 mr-2 text-blue-600" />
                                    Skills & Technologies
                                </h2>
                                <div className="flex flex-wrap gap-2">
                                    {identity.profile.skills.map((skill: string, index: number) => (
                                        <span
                                            key={index}
                                            className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium"
                                        >
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* Achievements */}
                        {identity.profile?.achievements && identity.profile.achievements.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                            >
                                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                                    <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
                                    Achievements
                                </h2>
                                <div className="space-y-4">
                                    {identity.profile.achievements.map((achievement: any, index: number) => (
                                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-gray-900">{achievement.title}</h3>
                                                    <p className="text-gray-600 text-sm mt-1">{achievement.description}</p>
                                                    <div className="flex items-center space-x-3 mt-2">
                                                        <span className={`text-xs px-2 py-1 rounded ${achievement.category === 'hackathon' ? 'bg-purple-100 text-purple-800' :
                                                            achievement.category === 'certification' ? 'bg-green-100 text-green-800' :
                                                                'bg-gray-100 text-gray-800'
                                                            }`}>
                                                            {achievement.category}
                                                        </span>
                                                        {achievement.points && (
                                                            <span className="text-xs text-yellow-600 font-medium">
                                                                +{achievement.points} points
                                                            </span>
                                                        )}
                                                        {achievement.dateAchieved && (
                                                            <span className="text-xs text-gray-500">
                                                                {new Date(achievement.dateAchieved).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {achievement.verified && (
                                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* Goals */}
                        {identity.profile?.goals && identity.profile.goals.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                            >
                                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                                    <Target className="w-5 h-5 mr-2 text-green-600" />
                                    Goals & Vision
                                </h2>
                                <div className="space-y-4">
                                    {identity.profile.goals.map((goal: any, index: number) => (
                                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                                            <h3 className="font-semibold text-gray-900">{goal.title}</h3>
                                            <p className="text-gray-600 text-sm mt-1">{goal.description}</p>
                                            <div className="flex items-center space-x-3 mt-2">
                                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                                    {goal.category}
                                                </span>
                                                <span className={`text-xs px-2 py-1 rounded ${goal.priority === 'high' ? 'bg-red-100 text-red-800' :
                                                    goal.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {goal.priority} priority
                                                </span>
                                                {goal.targetDate && (
                                                    <span className="text-xs text-gray-500">
                                                        Target: {new Date(goal.targetDate).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                            {goal.progress !== undefined && (
                                                <div className="mt-3">
                                                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                                                        <span>Progress</span>
                                                        <span>{goal.progress}%</span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                                        <div
                                                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                                            style={{ width: `${goal.progress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Quick Stats */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                        >
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Profile Stats</h3>
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
                                    <span className="text-gray-600">Created</span>
                                    <span className="font-semibold">
                                        {new Date(identity.createdAt || Date.now()).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Last Update</span>
                                    <span className="font-semibold">
                                        {new Date(identity.lastUpdate || Date.now()).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </motion.div>

                        {/* Social Links */}
                        {identity.profile?.socialLinks && Object.keys(identity.profile.socialLinks).some(key => identity.profile.socialLinks[key]) && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                            >
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Connect</h3>
                                <div className="space-y-3">
                                    {identity.profile.socialLinks.github && (
                                        <a
                                            href={identity.profile.socialLinks.github}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center text-gray-700 hover:text-gray-900 text-sm"
                                        >
                                            <span>GitHub</span>
                                            <ExternalLink className="w-3 h-3 ml-2" />
                                        </a>
                                    )}
                                    {identity.profile.socialLinks.twitter && (
                                        <a
                                            href={identity.profile.socialLinks.twitter}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center text-blue-600 hover:text-blue-700 text-sm"
                                        >
                                            <span>Twitter</span>
                                            <ExternalLink className="w-3 h-3 ml-2" />
                                        </a>
                                    )}
                                    {identity.profile.socialLinks.linkedin && (
                                        <a
                                            href={identity.profile.socialLinks.linkedin}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center text-blue-700 hover:text-blue-800 text-sm"
                                        >
                                            <span>LinkedIn</span>
                                            <ExternalLink className="w-3 h-3 ml-2" />
                                        </a>
                                    )}
                                    {identity.profile.socialLinks.website && (
                                        <a
                                            href={identity.profile.socialLinks.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center text-green-600 hover:text-green-700 text-sm"
                                        >
                                            <span>Website</span>
                                            <ExternalLink className="w-3 h-3 ml-2" />
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