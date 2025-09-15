'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, User, Search, Trophy, X, Upload, Calendar } from 'lucide-react'
import { api } from '@/utils/api'
import toast from 'react-hot-toast'

interface QuickActionsProps {
    identity: any
    onUpdate: () => void
}

export default function QuickActions({ identity, onUpdate }: QuickActionsProps) {
    const [showModal, setShowModal] = useState<'achievement' | 'profile' | 'explore' | null>(null)
    const [loading, setLoading] = useState(false)

    // Achievement form state
    const [newAchievement, setNewAchievement] = useState({
        title: '',
        description: '',
        category: 'project',
        dateAchieved: '',
        proof: '',
        points: 10
    })

    // Profile form state
    const [profileData, setProfileData] = useState({
        bio: identity?.profile?.bio || '',
        skills: identity?.profile?.skills?.join(', ') || '',
        twitter: identity?.profile?.socialLinks?.twitter || '',
        github: identity?.profile?.socialLinks?.github || '',
        linkedin: identity?.profile?.socialLinks?.linkedin || '',
        website: identity?.profile?.socialLinks?.website || ''
    })

    const handleAddAchievement = async () => {
        if (!newAchievement.title || !newAchievement.description) {
            toast.error('Please fill in title and description')
            return
        }

        try {
            setLoading(true)

            const achievementData = {
                ...newAchievement,
                id: `manual_${Date.now()}`,
                dateAchieved: new Date(newAchievement.dateAchieved),
                verified: false,
                valueImpact: Math.floor(newAchievement.points / 2)
            }

            // Add achievement via API
            const response = await api.addAchievement(identity.tokenId, achievementData);
            if (response.success) {
                toast.success('Achievement added successfully!')
                setShowModal(null)
                setNewAchievement({
                    title: '', description: '', category: 'project',
                    dateAchieved: '', proof: '', points: 10
                })
                onUpdate()
            } else {
                throw new Error(response.error || 'Failed to add achievement')
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to add achievement')
        } finally {
            setLoading(false)
        }
    }

    const handleUpdateProfile = async () => {
        try {
            setLoading(true)

            const updatedProfile = {
                bio: profileData.bio,
                skills: profileData.skills.split(',').map((s: string) => s.trim()).filter(Boolean),
                socialLinks: {
                    twitter: profileData.twitter,
                    github: profileData.github,
                    linkedin: profileData.linkedin,
                    website: profileData.website
                }
            }

            const response = await api.updateIdentity(identity.tokenId, {
                profile: { ...identity.profile, ...updatedProfile }
            })

            if (response.success) {
                toast.success('Profile updated successfully!')
                setShowModal(null)
                onUpdate()
            } else {
                throw new Error(response.error || 'Failed to update profile')
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to update profile')
        } finally {
            setLoading(false)
        }
    }

    const handleExploreNetwork = () => {
        // Navigate to explore page
        window.location.href = '/explore'
    }

    return (
        <>
            {/* Quick Actions Buttons */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                    <button
                        onClick={() => setShowModal('achievement')}
                        className="w-full flex items-center space-x-3 p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
                    >
                        <Plus className="w-5 h-5 text-blue-600" />
                        <span className="font-medium text-blue-700">Add Achievement</span>
                    </button>

                    <button
                        onClick={() => setShowModal('profile')}
                        className="w-full flex items-center space-x-3 p-3 bg-green-50 rounded-xl hover:bg-green-100 transition-colors"
                    >
                        <User className="w-5 h-5 text-green-600" />
                        <span className="font-medium text-green-700">Update Profile</span>
                    </button>

                    <button
                        onClick={handleExploreNetwork}
                        className="w-full flex items-center space-x-3 p-3 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors"
                    >
                        <Search className="w-5 h-5 text-purple-600" />
                        <span className="font-medium text-purple-700">Explore Network</span>
                    </button>
                </div>
            </div>

            {/* Modal Overlays */}
            <AnimatePresence>
                {showModal && (
                    <>
                        <div
                            className="fixed inset-0 bg-black/50 z-50"
                            onClick={() => setShowModal(null)}
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        >
                            <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                                {/* Add Achievement Modal */}
                                {showModal === 'achievement' && (
                                    <div className="p-6">
                                        <div className="flex items-center justify-between mb-6">
                                            <h2 className="text-xl font-bold text-gray-900">Add Achievement</h2>
                                            <button
                                                onClick={() => setShowModal(null)}
                                                className="p-2 hover:bg-gray-100 rounded-lg"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Title *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={newAchievement.title}
                                                    onChange={(e) => setNewAchievement({ ...newAchievement, title: e.target.value })}
                                                    placeholder="Achievement title"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Category
                                                </label>
                                                <select
                                                    value={newAchievement.category}
                                                    onChange={(e) => setNewAchievement({ ...newAchievement, category: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="project">Project</option>
                                                    <option value="hackathon">Hackathon</option>
                                                    <option value="certification">Certification</option>
                                                    <option value="education">Education</option>
                                                    <option value="work">Work</option>
                                                    <option value="community">Community</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Description *
                                                </label>
                                                <textarea
                                                    value={newAchievement.description}
                                                    onChange={(e) => setNewAchievement({ ...newAchievement, description: e.target.value })}
                                                    placeholder="Describe your achievement..."
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-20"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Date Achieved
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={newAchievement.dateAchieved}
                                                        onChange={(e) => setNewAchievement({ ...newAchievement, dateAchieved: e.target.value })}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Points
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={newAchievement.points}
                                                        onChange={(e) => setNewAchievement({ ...newAchievement, points: parseInt(e.target.value) || 10 })}
                                                        min="1"
                                                        max="100"
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Proof URL (optional)
                                                </label>
                                                <input
                                                    type="url"
                                                    value={newAchievement.proof}
                                                    onChange={(e) => setNewAchievement({ ...newAchievement, proof: e.target.value })}
                                                    placeholder="https://..."
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-6 flex space-x-3">
                                            <button
                                                onClick={() => setShowModal(null)}
                                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleAddAchievement}
                                                disabled={loading}
                                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                                            >
                                                {loading ? 'Adding...' : 'Add Achievement'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Update Profile Modal */}
                                {showModal === 'profile' && (
                                    <div className="p-6">
                                        <div className="flex items-center justify-between mb-6">
                                            <h2 className="text-xl font-bold text-gray-900">Update Profile</h2>
                                            <button
                                                onClick={() => setShowModal(null)}
                                                className="p-2 hover:bg-gray-100 rounded-lg"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Bio
                                                </label>
                                                <textarea
                                                    value={profileData.bio}
                                                    onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                                                    placeholder="Tell us about yourself..."
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-20"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Skills (comma separated)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={profileData.skills}
                                                    onChange={(e) => setProfileData({ ...profileData, skills: e.target.value })}
                                                    placeholder="JavaScript, Solidity, React..."
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Twitter
                                                    </label>
                                                    <input
                                                        type="url"
                                                        value={profileData.twitter}
                                                        onChange={(e) => setProfileData({ ...profileData, twitter: e.target.value })}
                                                        placeholder="https://twitter.com/..."
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        GitHub
                                                    </label>
                                                    <input
                                                        type="url"
                                                        value={profileData.github}
                                                        onChange={(e) => setProfileData({ ...profileData, github: e.target.value })}
                                                        placeholder="https://github.com/..."
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        LinkedIn
                                                    </label>
                                                    <input
                                                        type="url"
                                                        value={profileData.linkedin}
                                                        onChange={(e) => setProfileData({ ...profileData, linkedin: e.target.value })}
                                                        placeholder="https://linkedin.com/in/..."
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Website
                                                    </label>
                                                    <input
                                                        type="url"
                                                        value={profileData.website}
                                                        onChange={(e) => setProfileData({ ...profileData, website: e.target.value })}
                                                        placeholder="https://..."
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-6 flex space-x-3">
                                            <button
                                                onClick={() => setShowModal(null)}
                                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleUpdateProfile}
                                                disabled={loading}
                                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                                            >
                                                {loading ? 'Updating...' : 'Update Profile'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    )
}