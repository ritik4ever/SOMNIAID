'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { User, Edit3, ExternalLink, Twitter, Linkedin, Github, Save, X, Plus, RefreshCw } from 'lucide-react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/utils/contract'
import toast from 'react-hot-toast'

export interface Identity {
    tokenId: number
    username: string
    primarySkill: string
    reputationScore: number
    skillLevel: number
    achievementCount: number
    isVerified: boolean
    lastUpdate?: number | undefined
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
    // API-based profile state
    const [profile, setProfile] = useState<Identity | null>(null)
    const [isLoadingProfile, setIsLoadingProfile] = useState(false)

    const [isEditing, setIsEditing] = useState(false)
    const [showAddAchievement, setShowAddAchievement] = useState(false)

    // Use API profile data when available, fallback to prop
    const currentIdentity = profile || identity

    const [formData, setFormData] = useState({
        bio: currentIdentity?.profile?.bio || '',
        skills: currentIdentity?.profile?.skills?.join(', ') || '',
        twitter: currentIdentity?.profile?.socialLinks?.twitter || '',
        linkedin: currentIdentity?.profile?.socialLinks?.linkedin || '',
        github: currentIdentity?.profile?.socialLinks?.github || ''
    })

    // Achievement form state
    const [achievementForm, setAchievementForm] = useState({
        title: '',
        description: '',
        points: '50',
        priceImpact: '100'
    })

    const { address } = useAccount()
    const { writeContract, data: hash, isPending } = useWriteContract()
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash
    })

    // API profile fetching
    const fetchProfile = async () => {
        if (!address) return

        setIsLoadingProfile(true)
        try {
            const response = await fetch(`/api/identity/blockchain/${address}`)
            const data = await response.json()

            if (data.success && data.identity) {
                setProfile(data.identity)
                // Update form data with fetched profile
                setFormData({
                    bio: data.identity.profile?.bio || '',
                    skills: data.identity.profile?.skills?.join(', ') || '',
                    twitter: data.identity.profile?.socialLinks?.twitter || '',
                    linkedin: data.identity.profile?.socialLinks?.linkedin || '',
                    github: data.identity.profile?.socialLinks?.github || ''
                })
            }
        } catch (error) {
            console.error('Error fetching profile:', error)
        } finally {
            setIsLoadingProfile(false)
        }
    }

    // Fetch profile on address change
    useEffect(() => {
        fetchProfile()
    }, [address])

    // Listen for portfolio refresh events (after achievement addition)
    useEffect(() => {
        const handleRefresh = () => {
            fetchProfile()
        }

        window.addEventListener('portfolioRefresh', handleRefresh)
        return () => window.removeEventListener('portfolioRefresh', handleRefresh)
    }, [])

    // Update form data when currentIdentity changes
    useEffect(() => {
        if (currentIdentity) {
            setFormData({
                bio: currentIdentity.profile?.bio || '',
                skills: currentIdentity.profile?.skills?.join(', ') || '',
                twitter: currentIdentity.profile?.socialLinks?.twitter || '',
                linkedin: currentIdentity.profile?.socialLinks?.linkedin || '',
                github: currentIdentity.profile?.socialLinks?.github || ''
            })
        }
    }, [currentIdentity])

    useEffect(() => {
        if (isConfirmed) {
            toast.success('Achievement added successfully!')
            setShowAddAchievement(false)
            setAchievementForm({ title: '', description: '', points: '50', priceImpact: '100' })
            // Refresh profile data after achievement addition
            fetchProfile()
            window.dispatchEvent(new CustomEvent('portfolioRefresh'))
        }
    }, [isConfirmed])

    // Add achievement function
    const handleAddAchievement = async () => {
        if (!currentIdentity || !address || !achievementForm.title || !achievementForm.description) {
            toast.error('Please fill in all required fields')
            return
        }

        try {
            await writeContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'addAchievement',
                args: [
                    BigInt(currentIdentity.tokenId),
                    achievementForm.title,
                    achievementForm.description,
                    BigInt(achievementForm.points),
                    BigInt(achievementForm.priceImpact)
                ]
            })

            toast.loading('Adding achievement...')
        } catch (error: any) {
            console.error('Error adding achievement:', error)
            toast.error(error.message || 'Failed to add achievement')
        }
    }

    const handleSave = async () => {
        try {
            await new Promise(resolve => setTimeout(resolve, 1000))

            if (currentIdentity && typeof window !== 'undefined') {
                const updated: Identity = {
                    ...currentIdentity,
                    profile: {
                        ...currentIdentity.profile,
                        bio: formData.bio,
                        skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
                        socialLinks: {
                            twitter: formData.twitter,
                            linkedin: formData.linkedin,
                            github: formData.github,
                            website: currentIdentity.profile?.socialLinks?.website
                        }
                    }
                }
                localStorage.setItem(`identity_${currentIdentity.tokenId}`, JSON.stringify(updated))

                // Update local state
                setProfile(updated)
            }

            setIsEditing(false)
            toast.success('Profile updated!')
        } catch (error) {
            toast.error('Failed to update profile')
        }
    }

    const handleRefreshProfile = () => {
        fetchProfile()
        toast.success('Profile refreshed!')
    }

    if (!currentIdentity) {
        return (
            <div className="nft-card rounded-3xl p-6">
                <div className="text-center py-8">
                    {isLoadingProfile ? (
                        <div className="flex flex-col items-center">
                            <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
                            <p className="text-gray-500">Loading profile...</p>
                        </div>
                    ) : (
                        <>
                            <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500">No profile data</p>
                            {address && (
                                <button
                                    onClick={fetchProfile}
                                    className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                                >
                                    Try Again
                                </button>
                            )}
                        </>
                    )}
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
                <div className="flex space-x-2">
                    {/* Refresh Button */}
                    <button
                        onClick={handleRefreshProfile}
                        disabled={isLoadingProfile}
                        className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                        title="Refresh Profile"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoadingProfile ? 'animate-spin' : ''}`} />
                    </button>

                    {/* Add Achievement Button */}
                    <button
                        onClick={() => setShowAddAchievement(true)}
                        className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                        title="Add Achievement"
                    >
                        <Plus className="w-4 h-4" />
                    </button>

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
            </div>

            {/* Add Achievement Modal */}
            {showAddAchievement && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold">Add Achievement</h3>
                            <button
                                onClick={() => setShowAddAchievement(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Title *</label>
                                <input
                                    type="text"
                                    value={achievementForm.title}
                                    onChange={(e) => setAchievementForm(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="Achievement title"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Description *</label>
                                <textarea
                                    value={achievementForm.description}
                                    onChange={(e) => setAchievementForm(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    rows={3}
                                    placeholder="Describe your achievement"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Points</label>
                                    <input
                                        type="number"
                                        value={achievementForm.points}
                                        onChange={(e) => setAchievementForm(prev => ({ ...prev, points: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        min="1"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Price Impact (bp)</label>
                                    <input
                                        type="number"
                                        value={achievementForm.priceImpact}
                                        onChange={(e) => setAchievementForm(prev => ({ ...prev, priceImpact: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        min="0"
                                    />
                                </div>
                            </div>

                            <div className="flex space-x-3">
                                <button
                                    onClick={handleAddAchievement}
                                    disabled={isPending || isConfirming}
                                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                                >
                                    {isPending || isConfirming ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        'Add Achievement'
                                    )}
                                </button>
                                <button
                                    onClick={() => setShowAddAchievement(false)}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Avatar & Basic Info */}
            <div className="text-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-2xl">
                        {currentIdentity.username?.charAt(0) || '#'}
                    </span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                    {currentIdentity.username || `Token #${currentIdentity.tokenId || '...'}`}
                </h2>
                <p className="text-gray-600">{currentIdentity.primarySkill}</p>
                {profile && (
                    <div className="mt-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                            Live Data
                        </span>
                    </div>
                )}
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
                        {currentIdentity.profile?.bio || 'No bio available'}
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
                        {currentIdentity.profile?.skills?.length ? (
                            currentIdentity.profile.skills.map((skill, index) => (
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
                            currentIdentity.profile?.socialLinks?.twitter ? (
                                <a
                                    href={`https://twitter.com/${currentIdentity.profile.socialLinks.twitter}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 text-blue-600 hover:text-blue-700 text-sm flex items-center"
                                >
                                    @{currentIdentity.profile.socialLinks.twitter}
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
                            currentIdentity.profile?.socialLinks?.linkedin ? (
                                <a
                                    href={currentIdentity.profile.socialLinks.linkedin}
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
                            currentIdentity.profile?.socialLinks?.github ? (
                                <a
                                    href={`https://github.com/${currentIdentity.profile.socialLinks.github}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 text-gray-700 hover:text-gray-800 text-sm flex items-center"
                                >
                                    {currentIdentity.profile.socialLinks.github}
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