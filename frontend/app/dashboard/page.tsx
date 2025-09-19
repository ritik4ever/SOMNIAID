'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { readContract, getGasPrice, estimateGas } from 'wagmi/actions'
import { formatEther, parseEther, formatGwei, parseGwei } from 'viem'
import { motion } from 'framer-motion'
import { marketplaceAPI } from '@/utils/api';
import { User, Zap, Trophy, Plus, Search, TrendingUp, ExternalLink, Tag, RefreshCw, Target, Clock, DollarSign } from 'lucide-react'
import { ReputationCard } from '@/components/dashboard/ReputationCard'
import { CreateIdentity } from '@/components/dashboard/CreateIdentity'
import { ProfileSection } from '@/components/dashboard/ProfileSection'
import { AchievementCard } from '@/components/dashboard/AchievementCard'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { api } from '@/utils/api'
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/utils/contract'
import toast from 'react-hot-toast'
import { WalletDebugComponent } from '@/components/WalletDebugComponent'
import { NetworkSwitcher } from '@/components/NetworkSwitcher'
import { useTokenPrice } from '@/hooks/useTokenPrice'
import { useNFTEventSync } from '@/hooks/useNFTEventSync'
import { config } from '@/utils/wagmi'
import {
    getSomniaGasConfig,
    getEmergencyGasConfig,
    debugContractState,
    getAutoGasConfig,
    formatGasConfig,
    type LegacyGasConfig
} from '@/utils/gasEstimation'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface EnhancedIdentity {
    tokenId: number
    username: string
    primarySkill: string
    reputationScore: number
    skillLevel: number
    achievementCount: number
    isVerified: boolean
    lastUpdate?: number
    txHash?: string
    ownerAddress?: string
    basePrice: number
    currentPrice: number
    priceMultiplier: number
    profile?: {
        bio?: string
        skills?: string[]
        achievements?: Array<{
            title: string
            description: string
            points: number
            timestamp: number | string | Date
            priceImpact: number
        }>
        goals?: Array<{
            title: string
            description: string
            deadline: number
            targetValue: number
            currentValue: number
            completed: boolean
            failed: boolean
            rewardPoints: number
            penaltyPoints: number
            priceBonus: number
            pricePenalty: number
        }>
        socialLinks?: any
        priceHistory?: number[]
        priceTimestamps?: number[]
    }
    source?: string
    dbSynced?: boolean
}

// FIXED: Utility function to convert Wei to STT and format properly
const formatPrice = (priceInWei: number | string | bigint): string => {
    try {
        if (!priceInWei || priceInWei === 0) return '0.001'

        // Convert to string first, then to BigInt to handle large numbers
        const priceStr = priceInWei.toString()
        const priceETH = formatEther(BigInt(priceStr))
        const priceNum = parseFloat(priceETH)

        // Return properly formatted price (max 6 decimal places)
        return priceNum < 0.000001 ? '0.001' : priceNum.toFixed(6).replace(/\.?0+$/, '')
    } catch (error) {
        console.error('Error formatting price:', error, 'Input:', priceInWei)
        return '0.001'
    }
}

// FIXED: Utility to shorten address for display
const shortenAddress = (address: string, startLength = 6, endLength = 4): string => {
    if (!address) return ''
    if (address.length <= startLength + endLength) return address
    return `${address.slice(0, startLength)}...${address.slice(-endLength)}`
}

export default function EnhancedDashboardPage() {
    const { address, isConnected } = useAccount()

    const [userIdentity, setUserIdentity] = useState<EnhancedIdentity | null>(null)
    const [portfolioItems, setPortfolioItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [creating, setCreating] = useState(false)
    const [realTokenId, setRealTokenId] = useState<number | null>(null)

    const isCheckingIdentity = useRef(false)

    // Modal states
    const [showListModal, setShowListModal] = useState(false)
    const [showAchievementModal, setShowAchievementModal] = useState(false)
    const [showGoalModal, setShowGoalModal] = useState(false)
    const [listPrice, setListPrice] = useState('')
    const [isListing, setIsListing] = useState(false)

    // Achievement form state
    const [achievementForm, setAchievementForm] = useState({
        title: '',
        description: '',
        points: '',
        priceImpact: ''
    })

    // Goal form state
    const [goalForm, setGoalForm] = useState({
        title: '',
        description: '',
        deadline: '',
        targetValue: '',
        rewardPoints: '',
        penaltyPoints: '',
        priceBonus: '',
        pricePenalty: ''
    })

    const { price: sttUsdPrice, loading: priceLoading, error: priceError, lastUpdated, refreshPrice } = useTokenPrice('stt')
    const { writeContract, data: hash, error, isPending } = useWriteContract()
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })

    // FIXED: Identity check with proper error handling
    const checkUserIdentity = useCallback(async (force = false) => {
        if (isCheckingIdentity.current && !force) return

        if (!address) {
            setShowCreateForm(true)
            setLoading(false)
            return
        }

        try {
            isCheckingIdentity.current = true
            setLoading(true)

            const response = await fetch(`${API_BASE_URL}/api/identity/blockchain/${address}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                mode: 'cors',
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const data = await response.json()

            if (data.success && data.identity) {
                setUserIdentity(data.identity)
                setRealTokenId(data.identity.tokenId)
                setShowCreateForm(false)

                // Load portfolio separately
                await loadPortfolioInvestments()
                return
            }

            setUserIdentity(null)
            setShowCreateForm(true)

        } catch (error: any) {
            console.error('API Call Failed:', error)
            if (error.message.includes('CORS') || error.message.includes('fetch') || error.name === 'TypeError') {
                toast.error('Cannot connect to backend. Please check if backend is running.')
            } else {
                toast.error('Failed to load identity. Please try again.')
            }

            setUserIdentity(null)
            setShowCreateForm(true)
        } finally {
            setLoading(false)
            isCheckingIdentity.current = false
        }
    }, [address])

    // FIXED: Portfolio loading
    const loadPortfolioInvestments = useCallback(async () => {
        if (!address) return

        try {
            const response = await fetch(`${API_BASE_URL}/api/portfolio/${address}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                mode: 'cors',
            })

            if (!response.ok) return

            const portfolioData = await response.json()

            if (portfolioData.success && portfolioData.ownedNFTs) {
                // CRITICAL FIX: Filter out user's own identity from portfolio
                const investments = portfolioData.ownedNFTs.filter(
                    (nft: any) => nft.tokenId !== userIdentity?.tokenId
                )
                setPortfolioItems(investments)
            }
        } catch (error) {
            console.error('Portfolio loading failed:', error)
        }
    }, [address, userIdentity?.tokenId])

    const getBlockchainTokenId = async (userAddress: string): Promise<number | null> => {
        try {
            const hasIdentity = await readContract(config, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'hasIdentity',
                args: [userAddress as `0x${string}`]
            })

            if (!hasIdentity) return null

            const tokenId = await readContract(config, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getTokenIdByAddress',
                args: [userAddress as `0x${string}`]
            })

            return Number(tokenId)
        } catch (error: any) {
            console.error('Error getting blockchain token ID:', error)
            return null
        }
    }

    const executeTransactionWithGas = async (contractCall: any, operation: string) => {
        try {
            toast.loading(`${operation} - processing...`)
            const result = await writeContract(contractCall)
            toast.dismiss()
            toast.success(`${operation} submitted!`)
            return result
        } catch (autoError: any) {
            if (autoError.code === 4001) {
                toast.dismiss()
                toast.error('Transaction cancelled by user')
                throw autoError
            }

            try {
                const currentGasPrice = await getGasPrice(config)
                const bufferedGasPrice = BigInt(Math.floor(Number(currentGasPrice) * 1.2))

                const result = await writeContract({
                    ...contractCall,
                    gasPrice: bufferedGasPrice,
                })

                toast.dismiss()
                toast.success(`${operation} submitted with gas buffer!`)
                return result
            } catch (fallbackError: any) {
                toast.dismiss()
                console.error(`${operation} failed completely:`, fallbackError)
                throw fallbackError
            }
        }
    }

    // FIXED: Listing function with better error handling
    const handleListForSale = async () => {
        if (!listPrice || !address || !userIdentity) {
            toast.error('Missing required information');
            return;
        }

        try {
            setIsListing(true);

            // First execute blockchain transaction
            const tx = await writeContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'listIdentity',
                args: [BigInt(userIdentity.tokenId), parseEther(listPrice)],
            });

            // Then update backend
            const response = await marketplaceAPI.listNFT(
                userIdentity.tokenId,
                parseFloat(listPrice),
                address
            );

            if (response.success) {
                toast.success('NFT listed for sale!');
                setShowListModal(false);
                setListPrice('');
            }
        } catch (error) {
            console.error('Listing failed:', error);
            toast.error('Failed to list NFT');
        } finally {
            setIsListing(false);
        }
    };

    const handleAddAchievement = async () => {
        if (!address || !realTokenId || !userIdentity) {
            toast.error('No identity found')
            return
        }

        if (!achievementForm.title || !achievementForm.points) {
            toast.error('Please fill in required fields')
            return
        }

        try {
            await executeTransactionWithGas({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'addAchievement',
                args: [
                    BigInt(realTokenId),
                    achievementForm.title,
                    achievementForm.description,
                    BigInt(achievementForm.points),
                    BigInt(achievementForm.priceImpact || '0')
                ],
            }, 'Achievement addition')

        } catch (error: any) {
            if (error.code !== 4001) {
                toast.error(`Failed to add achievement: ${error.message}`)
            }
        }
    }

    const handleSetGoal = async () => {
        if (!address || !realTokenId || !userIdentity) {
            toast.error('No identity found')
            return
        }

        if (!goalForm.title || !goalForm.deadline || !goalForm.targetValue) {
            toast.error('Please fill in required fields')
            return
        }

        try {
            const deadlineTimestamp = Math.floor(new Date(goalForm.deadline).getTime() / 1000)

            await executeTransactionWithGas({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'setGoal',
                args: [
                    BigInt(realTokenId),
                    goalForm.title,
                    goalForm.description,
                    BigInt(deadlineTimestamp),
                    BigInt(goalForm.targetValue),
                    BigInt(goalForm.rewardPoints || '0'),
                    BigInt(goalForm.penaltyPoints || '0'),
                    BigInt(goalForm.priceBonus || '0'),
                    BigInt(goalForm.pricePenalty || '0')
                ],
            }, 'Goal setting')

        } catch (error: any) {
            if (error.code !== 4001) {
                toast.error(`Failed to set goal: ${error.message}`)
            }
        }
    }

    const handleIdentityUpdated = useCallback(() => {
        checkUserIdentity(true)
    }, [checkUserIdentity])

    const { isListening } = useNFTEventSync({
        onIdentityCreated: handleIdentityUpdated,
        onIdentityPurchased: handleIdentityUpdated,
        onReputationUpdated: handleIdentityUpdated,
        onAchievementUnlocked: handleIdentityUpdated,
        refreshIdentity: handleIdentityUpdated
    })

    const refreshPortfolio = useCallback(async () => {
        await checkUserIdentity(true)
        toast.success('Portfolio refreshed!')
    }, [checkUserIdentity])

    const SyncStatus = () => (
        <div className="text-xs text-gray-500 flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-400' : 'bg-gray-400'}`} />
            <span>{isListening ? 'Live sync' : 'Offline'}</span>
        </div>
    )

    useEffect(() => {
        if (isConnected && address) {
            checkUserIdentity()
        } else {
            setUserIdentity(null)
            setPortfolioItems([])
            setLoading(false)
            setShowCreateForm(false)
        }
    }, [isConnected, address, checkUserIdentity])

    useEffect(() => {
        if (isConfirmed && hash) {
            if (isListing) {
                toast.dismiss()
                toast.success('Identity listed for sale successfully!')
                setIsListing(false)
                setShowListModal(false)
                setListPrice('')
            } else {
                toast.success('Transaction confirmed!')
                setAchievementForm({ title: '', description: '', points: '', priceImpact: '' })
                setGoalForm({
                    title: '',
                    description: '',
                    deadline: '',
                    targetValue: '',
                    rewardPoints: '',
                    penaltyPoints: '',
                    priceBonus: '',
                    pricePenalty: ''
                })
                setShowAchievementModal(false)
                setShowGoalModal(false)
            }

            setTimeout(() => {
                refreshPortfolio()
            }, 3000)
        }
    }, [isConfirmed, hash, isListing, refreshPortfolio])

    const handleIdentityCreated = useCallback((newIdentity: any) => {
        setUserIdentity({
            ...newIdentity,
            lastUpdate: Date.now()
        })
        setShowCreateForm(false)
        setCreating(false)
        toast.success('Identity created successfully!')

        setTimeout(() => {
            checkUserIdentity(true)
        }, 3000)
    }, [checkUserIdentity])

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen pt-20 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-gray-600">Loading your enhanced dashboard...</p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Not connected state
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
                            Connect your wallet to access your Enhanced SomniaID dashboard with dynamic pricing.
                        </p>
                        <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Enhanced Features</h2>
                            <div className="space-y-3 text-left">
                                <div className="flex items-center space-x-3">
                                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                        <DollarSign className="w-3 h-3 text-blue-600" />
                                    </div>
                                    <span className="text-gray-700">Dynamic pricing based on achievements</span>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                                        <Target className="w-3 h-3 text-green-600" />
                                    </div>
                                    <span className="text-gray-700">Set goals with rewards and penalties</span>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                                        <TrendingUp className="w-3 h-3 text-purple-600" />
                                    </div>
                                    <span className="text-gray-700">Real-time price tracking and history</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        )
    }

    // Create form state
    if (!userIdentity || showCreateForm) {
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
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Enhanced SomniaID</h1>
                            <p className="text-gray-600">Dynamic reputation NFT with goal-based pricing</p>
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
                                Welcome back, {userIdentity?.username}!
                            </h1>
                            <p className="text-xl text-gray-600">
                                Your SomniaID: Token #{userIdentity?.tokenId} | {portfolioItems.length} NFT investments
                            </p>

                            {/* FIXED: Proper price display */}
                            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white p-3 rounded-lg shadow-sm">
                                    <div className="text-sm text-gray-500">Base Price</div>
                                    <div className="font-bold">
                                        {formatPrice(userIdentity?.basePrice || 0)} STT
                                    </div>
                                </div>
                                <div className="bg-white p-3 rounded-lg shadow-sm">
                                    <div className="text-sm text-gray-500">Current Price</div>
                                    <div className="font-bold text-green-600">
                                        {formatPrice(userIdentity?.currentPrice || 0)} STT
                                    </div>
                                </div>
                                <div className="bg-white p-3 rounded-lg shadow-sm">
                                    <div className="text-sm text-gray-500">Price Change</div>
                                    <div className={`font-bold ${(userIdentity?.currentPrice || 0) > (userIdentity?.basePrice || 0) ? 'text-green-600' : 'text-red-600'}`}>
                                        {(() => {
                                            const current = parseFloat(formatPrice(userIdentity?.currentPrice || 0))
                                            const base = parseFloat(formatPrice(userIdentity?.basePrice || 0.001))
                                            const change = ((current - base) / base) * 100
                                            return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`
                                        })()}
                                    </div>
                                </div>
                                <div className="bg-white p-3 rounded-lg shadow-sm">
                                    <div className="text-sm text-gray-500">Goals</div>
                                    <div className="font-bold">{userIdentity?.profile?.goals?.length || 0} Active</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        {/* Reputation cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <ReputationCard
                                score={userIdentity?.reputationScore || 0}
                                level={userIdentity?.skillLevel || 1}
                                title="Your Reputation"
                                subtitle={`Level ${userIdentity?.skillLevel || 1}`}
                                icon={TrendingUp}
                                gradient="from-blue-500 to-indigo-500"
                            />
                            <ReputationCard
                                score={userIdentity?.achievementCount || 0}
                                level={userIdentity?.skillLevel || 1}
                                title="Your Achievements"
                                subtitle="Unlocked"
                                icon={Trophy}
                                gradient="from-yellow-500 to-orange-500"
                            />
                            <ReputationCard
                                score={portfolioItems.length}
                                level={userIdentity?.skillLevel || 1}
                                title="Portfolio NFTs"
                                subtitle="Investments"
                                icon={Target}
                                gradient="from-green-500 to-teal-500"
                            />
                        </div>

                        <ProfileSection identity={userIdentity} />

                        {/* Portfolio investments section */}
                        {portfolioItems.length > 0 && (
                            <motion.div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                                <h2 className="text-2xl font-bold text-gray-900 mb-6">Your NFT Investments</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {portfolioItems.map((nft, index) => (
                                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="font-semibold">{nft.username}</h3>
                                                <span className="text-sm text-gray-500">#{nft.tokenId}</span>
                                            </div>
                                            <p className="text-sm text-gray-600">{nft.primarySkill}</p>
                                            <div className="mt-2 flex justify-between text-sm">
                                                <span>Paid: {formatPrice(nft.purchasePrice)} STT</span>
                                                <span className={nft.priceChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                    {nft.priceChange >= 0 ? '+' : ''}{nft.priceChangePercent?.toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-8">
                        <motion.div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
                            <div className="space-y-3">
                                <button
                                    onClick={() => setShowAchievementModal(true)}
                                    className="w-full flex items-center space-x-3 p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
                                >
                                    <Plus className="w-5 h-5 text-blue-600" />
                                    <span className="font-medium text-blue-700">Add Achievement</span>
                                </button>
                                <button
                                    onClick={() => setShowGoalModal(true)}
                                    className="w-full flex items-center space-x-3 p-3 bg-green-50 rounded-xl hover:bg-green-100 transition-colors"
                                >
                                    <Target className="w-5 h-5 text-green-600" />
                                    <span className="font-medium text-green-700">Set Goal</span>
                                </button>
                                <button
                                    onClick={() => setShowListModal(true)}
                                    className="w-full flex items-center space-x-3 p-3 bg-yellow-50 rounded-xl hover:bg-yellow-100 transition-colors"
                                >
                                    <Tag className="w-5 h-5 text-yellow-600" />
                                    <span className="font-medium text-yellow-700">List for Sale</span>
                                </button>
                                <button
                                    onClick={refreshPortfolio}
                                    className="w-full flex items-center space-x-3 p-3 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors"
                                >
                                    <RefreshCw className="w-5 h-5 text-indigo-600" />
                                    <span className="font-medium text-indigo-700">Refresh</span>
                                </button>
                            </div>
                            <div className="mt-4">
                                <SyncStatus />
                            </div>
                        </motion.div>

                        <motion.div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Your Identity Details</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Token ID</span>
                                    <span className="font-semibold">#{userIdentity?.tokenId}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Address</span>
                                    <span className="font-semibold text-sm font-mono">
                                        {shortenAddress(address || '', 6, 4)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Status</span>
                                    <span className="font-semibold text-green-600">Verified</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Portfolio Size</span>
                                    <span className="font-semibold">{portfolioItems.length} NFTs</span>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>

                {/* Achievement Modal */}
                {showAchievementModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">Add Achievement</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                                    <input
                                        type="text"
                                        value={achievementForm.title}
                                        onChange={(e) => setAchievementForm({ ...achievementForm, title: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        placeholder="Achievement title"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                                    <textarea
                                        value={achievementForm.description}
                                        onChange={(e) => setAchievementForm({ ...achievementForm, description: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        placeholder="Achievement description"
                                        rows={3}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Points *</label>
                                        <input
                                            type="number"
                                            value={achievementForm.points}
                                            onChange={(e) => setAchievementForm({ ...achievementForm, points: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            placeholder="50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Price Impact (bp)</label>
                                        <input
                                            type="number"
                                            value={achievementForm.priceImpact}
                                            onChange={(e) => setAchievementForm({ ...achievementForm, priceImpact: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            placeholder="100"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex space-x-3 mt-6">
                                <button
                                    onClick={() => setShowAchievementModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddAchievement}
                                    disabled={!achievementForm.title || !achievementForm.points}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    Add Achievement
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Goal Modal */}
                {showGoalModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">Set New Goal</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                                    <input
                                        type="text"
                                        value={goalForm.title}
                                        onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        placeholder="Complete certification course"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                                    <textarea
                                        value={goalForm.description}
                                        onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        placeholder="Goal description"
                                        rows={2}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Deadline *</label>
                                        <input
                                            type="date"
                                            value={goalForm.deadline}
                                            onChange={(e) => setGoalForm({ ...goalForm, deadline: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Target Value *</label>
                                        <input
                                            type="number"
                                            value={goalForm.targetValue}
                                            onChange={(e) => setGoalForm({ ...goalForm, targetValue: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            placeholder="100"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex space-x-3 mt-6">
                                <button
                                    onClick={() => setShowGoalModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSetGoal}
                                    disabled={!goalForm.title || !goalForm.deadline || !goalForm.targetValue}
                                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                    Set Goal
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Listing Modal */}
                {showListModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">List Enhanced NFT for Sale</h3>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Price (STT)</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    min="0.001"
                                    value={listPrice}
                                    onChange={(e) => setListPrice(e.target.value)}
                                    placeholder="Enter price in STT"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Current NFT value: {formatPrice(userIdentity?.currentPrice || 0)} STT
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
                                    {isListing ? 'Processing...' : 'List for Sale'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}