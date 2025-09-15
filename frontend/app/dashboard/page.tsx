'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { motion } from 'framer-motion'
import { User, Zap, Trophy, Plus, Search, TrendingUp, ExternalLink, Tag } from 'lucide-react'
import { ReputationCard } from '@/components/dashboard/ReputationCard'
import { CreateIdentity } from '@/components/dashboard/CreateIdentity'
import { ProfileSection } from '@/components/dashboard/ProfileSection'
import { AchievementCard } from '@/components/dashboard/AchievementCard'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { api } from '@/utils/api'
import { CONTRACT_ABI } from '@/utils/contract'
import toast from 'react-hot-toast'
import QuickActions from '@/components/dashboard/QuickActions'
import { WalletDebugComponent } from '@/components/WalletDebugComponent'
import { NetworkSwitcher } from '@/components/NetworkSwitcher'
import { parseEther } from 'viem'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`

interface UserIdentity {
    tokenId: number
    username: string
    primarySkill: string
    reputationScore: number
    skillLevel: number
    achievementCount: number
    isVerified: boolean
    lastUpdate?: number
    txHash?: string
    profile?: {
        bio?: string
        skills?: string[]
        achievements?: Array<{
            title: string
            description: string
            points: number
            timestamp: number | string | Date
        }>
        socialLinks?: any
    }
}

export default function DashboardPage() {
    const { address, isConnected } = useAccount()
    const [identity, setIdentity] = useState<UserIdentity | null>(null)
    const [loading, setLoading] = useState(true)
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [creating, setCreating] = useState(false)

    // Listing modal state
    const [showListModal, setShowListModal] = useState(false)
    const [listPrice, setListPrice] = useState('')
    const [isListing, setIsListing] = useState(false)

    const { writeContract, data: hash, error, isPending } = useWriteContract()

    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash,
    })

    useEffect(() => {
        if (isConnected && address) {
            checkUserIdentity()
        } else {
            setLoading(false)
        }
    }, [isConnected, address])

    useEffect(() => {
        if (isConfirmed && hash) {
            toast.success('Identity created successfully!')
            checkUserIdentity()
        }
    }, [isConfirmed, hash])

    // Add this useEffect to handle listing confirmation
    useEffect(() => {
        if (isConfirmed && isListing) {
            toast.dismiss()
            toast.success('Identity listed for sale!')
            setIsListing(false)
            setShowListModal(false)
            setListPrice('')
        }
    }, [isConfirmed, isListing])

    const checkUserIdentity = async () => {
        try {
            setLoading(true)

            const response = await api.getIdentities(1, 50)

            if (response.success && response.identities) {
                const userIdentity = response.identities.find((id: any) =>
                    id.ownerAddress?.toLowerCase() === address?.toLowerCase()
                )

                if (userIdentity) {
                    setIdentity({
                        tokenId: userIdentity.tokenId,
                        username: userIdentity.username,
                        primarySkill: userIdentity.primarySkill,
                        reputationScore: userIdentity.reputationScore,
                        skillLevel: userIdentity.skillLevel,
                        achievementCount: userIdentity.achievementCount,
                        isVerified: userIdentity.isVerified,
                        lastUpdate: userIdentity.lastUpdate,
                        txHash: userIdentity.txHash,
                        profile: userIdentity.profile
                    })
                } else {
                    setShowCreateForm(true)
                }
            } else {
                setShowCreateForm(true)
            }
        } catch (error) {
            console.error('Error checking identity:', error)
            setShowCreateForm(true)
        } finally {
            setLoading(false)
        }
    }

    const handleIdentityCreated = (newIdentity: any) => {
        setIdentity({
            ...newIdentity,
            lastUpdate: Date.now()
        })
        setShowCreateForm(false)
        setCreating(false)
        toast.success('Identity created successfully!')
    }

    // Add this function after your existing functions
    const handleListForSale = async () => {
        if (!listPrice || parseFloat(listPrice) <= 0) {
            toast.error('Please enter a valid price')
            return
        }

        try {
            setIsListing(true)

            writeContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'listIdentity',
                args: [BigInt(identity!.tokenId), parseEther(listPrice)]
            })

            toast.loading('Listing your identity for sale...')
        } catch (error: any) {
            console.error('Listing error:', error)
            toast.error('Failed to list identity')
            setIsListing(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen pt-20 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-gray-600">Loading your dashboard...</p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (!isConnected) {
        return (
            <div className="min-h-screen pt-20 bg-gray-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center"
                    >
                        <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <User className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-4xl font-bold text-gray-900 mb-4">Connect Your Wallet</h1>
                        <p className="text-xl text-gray-600 mb-8">
                            Connect your wallet to access your SomniaID dashboard and manage your digital identity.
                        </p>
                        <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Getting Started</h2>
                            <div className="space-y-3 text-left">
                                <div className="flex items-center space-x-3">
                                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                        <span className="text-blue-600 font-bold text-sm">1</span>
                                    </div>
                                    <span className="text-gray-700">Connect your wallet with Somnia Network</span>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                        <span className="text-blue-600 font-bold text-sm">2</span>
                                    </div>
                                    <span className="text-gray-700">Get testnet STT tokens from faucet</span>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                        <span className="text-blue-600 font-bold text-sm">3</span>
                                    </div>
                                    <span className="text-gray-700">Create your SomniaID identity</span>
                                </div>
                            </div>
                        </div>

                        {/* Debug Components */}
                        <div className="mt-8 space-y-4">
                            <WalletDebugComponent />
                            <NetworkSwitcher />
                        </div>
                    </motion.div>
                </div>
            </div>
        )
    }

    if (showCreateForm || !identity) {
        return (
            <div className="min-h-screen pt-20 bg-gray-50">
                <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100"
                    >
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Zap className="w-10 h-10 text-white" />
                            </div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your SomniaID</h1>
                            <p className="text-gray-600">Your dynamic reputation NFT on Somnia Network</p>
                        </div>
                        <CreateIdentity
                            onIdentityCreated={handleIdentityCreated}
                            isCreating={creating || isPending || isConfirming}
                        />
                        {hash && (
                            <div className="mt-6 p-4 bg-blue-50 rounded-xl">
                                <p className="text-sm text-blue-700 mb-2">Transaction submitted:</p>
                                <a
                                    href={`https://shannon-explorer.somnia.network/tx/${hash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline text-sm font-mono break-all flex items-center gap-1"
                                >
                                    {hash} <ExternalLink className="w-3 h-3" />
                                </a>
                                {isConfirming && (
                                    <p className="text-sm text-blue-600 mt-2">Waiting for confirmation...</p>
                                )}
                            </div>
                        )}

                        {/* Debug Components */}
                        <div className="mt-8 space-y-4">
                            <WalletDebugComponent />
                            <NetworkSwitcher />
                        </div>
                    </motion.div>
                </div>
            </div>
        )
    }

    // Main dashboard view
    return (
        <div className="min-h-screen pt-20 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold text-gray-900 mb-2">
                                Welcome back, {identity.username}!
                            </h1>
                            <p className="text-xl text-gray-600">
                                Your reputation is growing on Somnia Network
                            </p>
                        </div>
                        {identity.txHash && (
                            <a
                                href={`https://shannon-explorer.somnia.network/tx/${identity.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm"
                            >
                                <span>View Transaction</span>
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        )}
                    </div>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <ReputationCard
                                score={identity.reputationScore}
                                level={identity.skillLevel}
                                title="Reputation Score"
                                subtitle={`Level ${identity.skillLevel}`}
                                icon={TrendingUp}
                                gradient="from-blue-500 to-indigo-500"
                            />
                            <ReputationCard
                                score={identity.achievementCount}
                                level={identity.skillLevel}
                                title="Achievements"
                                subtitle="Unlocked"
                                icon={Trophy}
                                gradient="from-yellow-500 to-orange-500"
                            />
                            <ReputationCard
                                score={identity.skillLevel}
                                level={identity.skillLevel}
                                title="Skill Level"
                                subtitle={identity.primarySkill}
                                icon={Zap}
                                gradient="from-green-500 to-teal-500"
                            />
                        </div>

                        <ProfileSection identity={identity} />

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">Recent Achievements</h2>
                                <button className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl hover:bg-blue-100 transition-colors">
                                    View All
                                </button>
                            </div>

                            {identity.profile?.achievements && identity.profile.achievements.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {identity.profile.achievements.slice(0, 4).map((achievement, index) => (
                                        <AchievementCard
                                            key={index}
                                            title={achievement.title}
                                            description={achievement.description}
                                            points={achievement.points}
                                            timestamp={achievement.timestamp}
                                            category="achievement"
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-500 mb-4">No achievements yet</p>
                                    <button className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300">
                                        Unlock Your First Achievement
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </div>

                    <div className="space-y-8">
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                        >
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
                            <div className="space-y-3">
                                <button className="w-full flex items-center space-x-3 p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
                                    <Plus className="w-5 h-5 text-blue-600" />
                                    <span className="font-medium text-blue-700">Add Achievement</span>
                                </button>
                                <button className="w-full flex items-center space-x-3 p-3 bg-green-50 rounded-xl hover:bg-green-100 transition-colors">
                                    <User className="w-5 h-5 text-green-600" />
                                    <span className="font-medium text-green-700">Update Profile</span>
                                </button>

                                {/* List for Sale Button */}
                                <button
                                    onClick={() => setShowListModal(true)}
                                    className="w-full flex items-center space-x-3 p-3 bg-yellow-50 rounded-xl hover:bg-yellow-100 transition-colors"
                                >
                                    <Tag className="w-5 h-5 text-yellow-600" />
                                    <span className="font-medium text-yellow-700">List for Sale</span>
                                </button>

                                <button className="w-full flex items-center space-x-3 p-3 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors">
                                    <Search className="w-5 h-5 text-purple-600" />
                                    <span className="font-medium text-purple-700">Explore Network</span>
                                </button>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                        >
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Identity Details</h3>
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
                                    <span className="text-gray-600">Status</span>
                                    <span className={`font-semibold ${identity.isVerified ? 'text-green-600' : 'text-yellow-600'}`}>
                                        {identity.isVerified ? 'Verified' : 'Pending'}
                                    </span>
                                </div>
                            </div>
                        </motion.div>

                        <ActivityFeed />

                        {/* Debug Components */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 }}
                            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                        >
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Debug Tools</h3>
                            <div className="space-y-4">
                                <WalletDebugComponent />
                                <NetworkSwitcher />
                            </div>
                        </motion.div>
                    </div>
                </div>

                {/* List for Sale Modal */}
                {showListModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">List Identity for Sale</h3>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Price (STT)
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    value={listPrice}
                                    onChange={(e) => setListPrice(e.target.value)}
                                    placeholder="Enter price in STT"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    ~${(parseFloat(listPrice || '0') * 0.1).toFixed(2)} USD
                                </p>
                            </div>

                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                                <p className="text-yellow-800 text-sm">
                                    <strong>Testnet Only:</strong> This is Somnia testnet. Real trading on mainnet coming soon!
                                </p>
                            </div>

                            <div className="flex space-x-3">
                                <button
                                    onClick={() => setShowListModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleListForSale}
                                    disabled={isListing || !listPrice}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {isListing ? 'Listing...' : 'List for Sale'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}