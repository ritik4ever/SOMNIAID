'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { User, Edit3, ExternalLink, Twitter, Linkedin, Github, Save, X } from 'lucide-react'
import toast from 'react-hot-toast'

// ✅ Fixed Identity type definition
export interface Identity {
    tokenId: number
    username: string
    primarySkill: string
    reputationScore: number
    skillLevel: number
    achievementCount: number
    isVerified: boolean
    lastUpdate?: number | undefined // ✅ Explicitly optional
    profile?: {
        bio?: string
        skills?: string[]
        achievements?: any[]
        socialLinks?: {
            twitter?: string
            github?: string
            linkedin?: string
            website?: string
        }
    }
}

interface ProfileSectionProps {
    identity: Identity | null
}

export function ProfileSection({ identity }: ProfileSectionProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [formData, setFormData] = useState({
        bio: identity?.profile?.bio || '',
        skills: identity?.profile?.skills?.join(', ') || '',
        twitter: identity?.profile?.socialLinks?.twitter || '',
        linkedin: identity?.profile?.socialLinks?.linkedin || '',
        github: identity?.profile?.socialLinks?.github || ''
    })

    const handleSave = async () => {
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000))

            // Update local storage for demo
            if (identity && typeof window !== 'undefined') {
                const updated: Identity = {
                    ...identity,
                    profile: {
                        ...identity.profile,
                        bio: formData.bio,
                        skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
                        socialLinks: {
                            twitter: formData.twitter,
                            linkedin: formData.linkedin,
                            github: formData.github,
                            website: identity.profile?.socialLinks?.website
                        }
                    }
                }
                localStorage.setItem(`identity_${identity.tokenId}`, JSON.stringify(updated))
            }

            setIsEditing(false)
            toast.success('Profile updated!')
        } catch (error) {
            toast.error('Failed to update profile')
        }
    }

    if (!identity) {
        return (
            <div className="nft-card rounded-3xl p-6">
                <div className="text-center py-8">
                    <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No profile data</p>
                </div>
            </div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="nft-card rounded-3xl p-6"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Profile</h3>
                {isEditing ? (
                    <div className="flex space-x-2">
                        <button
                            onClick={handleSave}
                            className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                        >
                            <Save className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setIsEditing(false)}
                            className="p-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors"
                    >
                        <Edit3 className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Avatar & Basic Info */}
            <div className="text-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-2xl">
                        {identity.username?.charAt(0) || '#'}
                    </span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                    {identity.username || `Identity #${identity.tokenId}`}
                </h2>
                <p className="text-gray-600">{identity.primarySkill}</p>
            </div>

            {/* Bio */}
            <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-2">About</h4>
                {isEditing ? (
                    <textarea
                        value={formData.bio}
                        onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                        placeholder="Tell us about yourself..."
                        className="w-full p-3 border border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none resize-none"
                        rows={3}
                    />
                ) : (
                    <p className="text-gray-600 text-sm leading-relaxed">
                        {identity.profile?.bio || 'No bio available'}
                    </p>
                )}
            </div>

            {/* Skills */}
            <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-2">Skills</h4>
                {isEditing ? (
                    <input
                        type="text"
                        value={formData.skills}
                        onChange={(e) => setFormData(prev => ({ ...prev, skills: e.target.value }))}
                        placeholder="Comma-separated skills..."
                        className="w-full p-3 border border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
                    />
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {identity.profile?.skills?.length ? (
                            identity.profile.skills.map((skill, index) => (
                                <span
                                    key={index}
                                    className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm"
                                >
                                    {skill}
                                </span>
                            ))
                        ) : (
                            <span className="text-gray-400 text-sm">No skills listed</span>
                        )}
                    </div>
                )}
            </div>

            {/* Social Links */}
            <div>
                <h4 className="font-semibold text-gray-900 mb-3">Social Links</h4>
                <div className="space-y-3">
                    {/* Twitter */}
                    <div className="flex items-center space-x-3">
                        <Twitter className="w-5 h-5 text-blue-400" />
                        {isEditing ? (
                            <input
                                type="text"
                                value={formData.twitter}
                                onChange={(e) => setFormData(prev => ({ ...prev, twitter: e.target.value }))}
                                placeholder="Twitter username"
                                className="flex-1 p-2 border border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none text-sm"
                            />
                        ) : (
                            identity.profile?.socialLinks?.twitter ? (
                                <a
                                    href={`https://twitter.com/${identity.profile.socialLinks.twitter}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 text-blue-600 hover:text-blue-700 text-sm flex items-center"
                                >
                                    @{identity.profile.socialLinks.twitter}
                                    <ExternalLink className="w-3 h-3 ml-1" />
                                </a>
                            ) : (
                                <span className="text-gray-400 text-sm">Not connected</span>
                            )
                        )}
                    </div>

                    {/* LinkedIn */}
                    <div className="flex items-center space-x-3">
                        <Linkedin className="w-5 h-5 text-blue-600" />
                        {isEditing ? (
                            <input
                                type="text"
                                value={formData.linkedin}
                                onChange={(e) => setFormData(prev => ({ ...prev, linkedin: e.target.value }))}
                                placeholder="LinkedIn profile"
                                className="flex-1 p-2 border border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none text-sm"
                            />
                        ) : (
                            identity.profile?.socialLinks?.linkedin ? (
                                <a
                                    href={identity.profile.socialLinks.linkedin}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 text-blue-600 hover:text-blue-700 text-sm flex items-center"
                                >
                                    LinkedIn Profile
                                    <ExternalLink className="w-3 h-3 ml-1" />
                                </a>
                            ) : (
                                <span className="text-gray-400 text-sm">Not connected</span>
                            )
                        )}
                    </div>

                    {/* GitHub */}
                    <div className="flex items-center space-x-3">
                        <Github className="w-5 h-5 text-gray-700" />
                        {isEditing ? (
                            <input
                                type="text"
                                value={formData.github}
                                onChange={(e) => setFormData(prev => ({ ...prev, github: e.target.value }))}
                                placeholder="GitHub username"
                                className="flex-1 p-2 border border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none text-sm"
                            />
                        ) : (
                            identity.profile?.socialLinks?.github ? (
                                <a
                                    href={`https://github.com/${identity.profile.socialLinks.github}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 text-gray-700 hover:text-gray-800 text-sm flex items-center"
                                >
                                    {identity.profile.socialLinks.github}
                                    <ExternalLink className="w-3 h-3 ml-1" />
                                </a>
                            ) : (
                                <span className="text-gray-400 text-sm">Not connected</span>
                            )
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    )
}
