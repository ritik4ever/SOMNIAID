'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { readContract, getGasPrice, estimateGas } from 'wagmi/actions'
import { formatEther, parseEther, formatGwei, parseGwei } from 'viem'
import { motion } from 'framer-motion'
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

export default function EnhancedDashboardPage() {
    const { address, isConnected } = useAccount()
    const [identity, setIdentity] = useState<EnhancedIdentity | null>(null)
    const [loading, setLoading] = useState(true)
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [creating, setCreating] = useState(false)
    const [realTokenId, setRealTokenId] = useState<number | null>(null)
    const [userProfile, setUserProfile] = useState<any>(null)

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

    // Get real-time STT price
    const { price: sttUsdPrice, loading: priceLoading, error: priceError, lastUpdated, refreshPrice } = useTokenPrice('stt')

    const { writeContract, data: hash, error, isPending } = useWriteContract()
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })

    const loadUserProfile = async (address: string) => {
        try {
            console.log('Loading user profile for:', address);

            // CRITICAL FIX: Use the same API endpoint as marketplace
            const response = await fetch(`http://localhost:5000/api/identity/blockchain/${address}`);
            const data = await response.json();
            console.log('Profile API response:', data);

            if (data.success && data.identity) {
                // FIXED: Use REAL username from backend API response
                return {
                    tokenId: data.identity.tokenId,
                    username: data.identity.username, // THIS WILL BE "Sam", "Ritik", etc.
                    primarySkill: data.identity.primarySkill,
                    reputationScore: data.identity.reputationScore,
                    skillLevel: data.identity.skillLevel,
                    achievementCount: data.identity.achievementCount,
                    isVerified: data.identity.isVerified || true, // Set to true if on blockchain
                    currentPrice: data.identity.currentPrice || 0.001,
                    basePrice: data.identity.basePrice || 0.001,
                    priceMultiplier: data.identity.priceMultiplier || 100,
                    ownerAddress: data.identity.ownerAddress || address,
                    profile: data.identity.profile || {}
                };
            }
            return null;
        } catch (error) {
            console.error('Error loading user profile:', error);
            return null;
        }
    };

    // Enhanced blockchain token ID fetching
    const getBlockchainTokenId = async (userAddress: string): Promise<number | null> => {
        try {
            console.log('Getting blockchain token ID for:', userAddress)

            const hasIdentity = await readContract(config, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'hasIdentity',
                args: [userAddress as `0x${string}`]
            })

            if (!hasIdentity) {
                console.log('No identity found on blockchain for:', userAddress)
                return null
            }

            const tokenId = await readContract(config, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getTokenIdByAddress',
                args: [userAddress as `0x${string}`]
            })

            const finalTokenId = Number(tokenId)
            console.log('Found blockchain token ID:', finalTokenId)

            return finalTokenId

        } catch (error: any) {
            console.error('Error getting blockchain token ID:', error)
            return null
        }
    }

    // Get complete identity data from blockchain
    const getCompleteIdentityFromBlockchain = async (tokenId: number): Promise<EnhancedIdentity | null> => {
        try {
            console.log('Getting complete identity data for token:', tokenId)

            // Get basic identity
            const identity = await readContract(config, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getIdentity',
                args: [BigInt(tokenId)]
            }) as any

            // Get achievements
            const achievements = await readContract(config, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getAchievements',
                args: [BigInt(tokenId)]
            }) as any[]

            // Get goals
            const goals = await readContract(config, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getGoals',
                args: [BigInt(tokenId)]
            }) as any[]

            // Get owner address
            const owner = await readContract(config, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'ownerOf',
                args: [BigInt(tokenId)]
            }) as string

            // Format the complete identity
            const completeIdentity: EnhancedIdentity = {
                tokenId,
                username: `User #${tokenId}`, // You might want to store usernames in your backend
                primarySkill: identity.primarySkill,
                reputationScore: Number(identity.reputationScore),
                skillLevel: Number(identity.skillLevel),
                achievementCount: Number(identity.achievementCount),
                isVerified: identity.isVerified,
                lastUpdate: Number(identity.lastUpdate),
                ownerAddress: owner,
                basePrice: Number(identity.basePrice),
                currentPrice: Number(identity.currentPrice),
                priceMultiplier: Number(identity.priceMultiplier),
                profile: {
                    achievements: achievements.map((ach: any) => ({
                        title: ach.title,
                        description: ach.description,
                        points: Number(ach.points),
                        timestamp: Number(ach.timestamp),
                        priceImpact: Number(ach.priceImpact)
                    })),
                    goals: goals.map((goal: any) => ({
                        title: goal.title,
                        description: goal.description,
                        deadline: Number(goal.deadline),
                        targetValue: Number(goal.targetValue),
                        currentValue: Number(goal.currentValue),
                        completed: goal.completed,
                        failed: goal.failed,
                        rewardPoints: Number(goal.rewardPoints),
                        penaltyPoints: Number(goal.penaltyPoints),
                        priceBonus: Number(goal.priceBonus),
                        pricePenalty: Number(goal.pricePenalty)
                    }))
                },
                source: 'blockchain-complete',
                dbSynced: true
            }

            return completeIdentity

        } catch (error: any) {
            console.error('Error getting complete identity:', error)
            return null
        }
    }

    // Auto gas detection approach
    const approveMarketplaceAuto = async (): Promise<boolean> => {
        try {
            if (!address) return false

            toast.loading('Using auto gas detection...')

            console.group('🤖 AUTO GAS DETECTION')
            console.log('Letting network determine optimal gas prices...')

            await writeContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'setApprovalForAll',
                args: [CONTRACT_ADDRESS, true],
            })

            console.log('✅ Auto gas transaction submitted')
            console.groupEnd()

            toast.dismiss()
            toast.success('Auto gas approval submitted! Network will determine optimal gas.')

            return true
        } catch (error: any) {
            console.groupEnd()

            if (error.code === 4001) {
                toast.dismiss()
                toast.error('Transaction cancelled by user')
                return false
            }

            return await approveMarketplaceWithHint()
        }
    }

    const approveMarketplaceWithHint = async (): Promise<boolean> => {
        try {
            toast.loading('Auto detection failed, trying with gas hint...')

            const currentGasPrice = await getGasPrice(config)
            const suggestedGasPrice = BigInt(Math.floor(Number(currentGasPrice) * 3))

            const contractCall = {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'setApprovalForAll',
                args: [CONTRACT_ADDRESS, true],
                account: address as `0x${string}`,
            }

            const estimatedGas = await estimateGas(config, contractCall)
            const gasWithBuffer = BigInt(Math.floor(Number(estimatedGas) * 1.2))

            await writeContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'setApprovalForAll',
                args: [CONTRACT_ADDRESS, true],
                gas: gasWithBuffer,
                gasPrice: suggestedGasPrice,
            })

            toast.dismiss()
            toast.success('Approval with gas hint submitted!')

            return true
        } catch (error: any) {
            toast.dismiss()
            console.error('Gas hint approach failed:', error)
            toast.error(`Approval failed: ${error.message}`)
            return false
        }
    }

    // Smart auto detection for listing
    const handleListForSaleAuto = async () => {
        if (!listPrice || parseFloat(listPrice) <= 0) {
            toast.error('Please enter a valid price')
            return
        }

        if (!address) {
            toast.error('Wallet not connected')
            return
        }

        try {
            setIsListing(true)
            toast.loading('Starting auto-detected listing...')

            const blockchainTokenId = await getBlockchainTokenId(address)
            if (!blockchainTokenId) {
                throw new Error('No NFT found for your address')
            }

            const priceInWei = parseEther(listPrice)

            toast.dismiss()
            toast.loading('Auto-detecting optimal gas for listing...')

            try {
                await writeContract({
                    address: CONTRACT_ADDRESS,
                    abi: CONTRACT_ABI,
                    functionName: 'listIdentity',
                    args: [BigInt(blockchainTokenId), priceInWei],
                })
            } catch (autoError) {
                const networkGasPrice = await getGasPrice(config)
                const bufferedGasPrice = BigInt(Math.floor(Number(networkGasPrice) * 2))

                await writeContract({
                    address: CONTRACT_ADDRESS,
                    abi: CONTRACT_ABI,
                    functionName: 'listIdentity',
                    args: [BigInt(blockchainTokenId), priceInWei],
                    gasPrice: bufferedGasPrice,
                })
            }

            toast.dismiss()
            toast.loading('Listing submitted with auto gas! Waiting for confirmation...')

        } catch (error: any) {
            console.error('Auto listing failed:', error)
            setIsListing(false)
            toast.dismiss()

            if (error.code === 4001) {
                toast.error('Transaction cancelled')
            } else {
                toast.error(`Auto listing failed: ${error.message}`)
            }
        }
    }

    // Add achievement function
    const handleAddAchievement = async () => {
        if (!address || !realTokenId) {
            toast.error('No identity found')
            return
        }

        if (!achievementForm.title || !achievementForm.points) {
            toast.error('Please fill in required fields')
            return
        }

        try {
            toast.loading('Adding achievement...')

            await writeContract({
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
            })

            toast.dismiss()
            toast.loading('Achievement transaction submitted!')

        } catch (error: any) {
            toast.dismiss()
            console.error('Add achievement failed:', error)
            toast.error(`Failed to add achievement: ${error.message}`)
        }
    }

    // Set goal function
    const handleSetGoal = async () => {
        if (!address || !realTokenId) {
            toast.error('No identity found')
            return
        }

        if (!goalForm.title || !goalForm.deadline || !goalForm.targetValue) {
            toast.error('Please fill in required fields')
            return
        }

        try {
            toast.loading('Setting goal...')

            const deadlineTimestamp = Math.floor(new Date(goalForm.deadline).getTime() / 1000)

            await writeContract({
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
            })

            toast.dismiss()
            toast.loading('Goal transaction submitted!')

        } catch (error: any) {
            toast.dismiss()
            console.error('Set goal failed:', error)
            toast.error(`Failed to set goal: ${error.message}`)
        }
    }

    // Enhanced identity checking with complete blockchain data
    const checkUserIdentity = async () => {
        try {
            setLoading(true)

            if (!address) {
                console.log('No wallet address available')
                setShowCreateForm(true)
                return
            }

            console.group('Enhanced Identity Check for Address:', address)

            // Step 1: Get token ID from blockchain
            const blockchainTokenId = await getBlockchainTokenId(address)

            if (blockchainTokenId !== null) {
                console.log('✅ Found token ID on blockchain:', blockchainTokenId)
                setRealTokenId(blockchainTokenId)

                // Step 2: Get complete identity data from blockchain
                const completeIdentity = await getCompleteIdentityFromBlockchain(blockchainTokenId)

                if (completeIdentity) {
                    console.log('✅ Complete identity loaded from blockchain')
                    setIdentity(completeIdentity)
                    toast.success('Identity loaded successfully with real-time data!')
                    console.groupEnd()
                    return
                }
            }

            // Step 3: No identity found - show create form
            console.log('No identity found for address:', address)
            setShowCreateForm(true)

        } catch (error: any) {
            console.error('Error in enhanced identity check:', error)
            toast.error('Failed to check identity. Please try again.')
            setShowCreateForm(true)
        } finally {
            setLoading(false)
            console.groupEnd()
        }
    }

    // ADD this real-time sync integration AFTER checkUserIdentity is defined:
    const { isListening } = useNFTEventSync({
        onIdentityCreated: () => checkUserIdentity(),
        onIdentityPurchased: () => checkUserIdentity(),
        onReputationUpdated: () => checkUserIdentity(),
        onAchievementUnlocked: () => checkUserIdentity(),
        refreshIdentity: checkUserIdentity
    })

    // Network gas price monitoring
    const monitorNetworkGas = async () => {
        try {
            console.group('📊 NETWORK GAS MONITORING')

            const currentPrice = await getGasPrice(config)
            console.log('Current network gas price:', formatGwei(currentPrice), 'gwei')

            const priceInGwei = Number(formatGwei(currentPrice))

            if (priceInGwei < 1) {
                console.warn('⚠️ Network gas price very low:', priceInGwei, 'gwei')
            } else if (priceInGwei > 100) {
                console.warn('⚠️ Network gas price very high:', priceInGwei, 'gwei')
            } else {
                console.log('✅ Network gas price looks reasonable')
            }

            console.groupEnd()
            toast.success(`Network gas: ${priceInGwei.toFixed(1)} gwei`)

        } catch (error) {
            console.error('Gas monitoring failed:', error)
            toast.error('Could not check network gas prices')
        }
    }

    const debugGasEstimation = async () => {
        try {
            if (!address) return

            console.group('🔍 GAS ESTIMATION DEBUG')

            const testConfig = {
                gas: BigInt(200000),
                gasPrice: parseGwei('300')
            }

            console.log('Test gas config:')
            console.log('- gas:', testConfig.gas.toString())
            console.log('- gasPrice (gwei):', formatGwei(testConfig.gasPrice))

            try {
                const networkGasPrice = await getGasPrice(config)
                console.log('Network gas price:', formatGwei(networkGasPrice), 'gwei')
            } catch (e) {
                console.log('Could not get network gas price:', e)
            }

            console.groupEnd()
            toast.success('Gas debug complete - check console')

        } catch (error) {
            console.error('Gas debug failed:', error)
            console.groupEnd()
        }
    }

    // Make sure your portfolio component refetches data
    const refreshPortfolio = async () => {
        await checkUserIdentity()
        toast.success(`Portfolio refreshed! ${isListening ? '🔄 Live sync active' : ''}`)
    }

    // ADD this sync status component:
    const SyncStatus = () => (
        <div className="text-xs text-gray-500 flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-400' : 'bg-gray-400'}`} />
            <span>{isListening ? 'Live sync' : 'Offline'}</span>
        </div>
    )

    // Add this test component to verify your price API:
    const PriceDebugger = () => {
        return (
            <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-bold mb-2">Price API Debug</h3>
                <div className="space-y-2 text-sm">
                    <div>Price: ${sttUsdPrice.toFixed(4)}</div>
                    <div>Loading: {priceLoading ? 'Yes' : 'No'}</div>
                    <div>Error: {priceError || 'None'}</div>
                    {lastUpdated && <div>Last Updated: {new Date(lastUpdated).toLocaleTimeString()}</div>}
                    {refreshPrice && (
                        <button
                            onClick={refreshPrice}
                            className="px-3 py-1 bg-blue-500 text-white rounded"
                        >
                            Force Refresh
                        </button>
                    )}
                </div>
            </div>
        )
    }

    const approveMarketplace = approveMarketplaceAuto
    const handleListForSale = handleListForSaleAuto

    // useEffect for loadUserProfile
    useEffect(() => {
        if (address) {
            loadUserProfile(address).then(profile => {
                if (profile) {
                    setUserProfile(profile);
                }
            });
        }
    }, [address]);

    useEffect(() => {
        if (isConnected && address) {
            checkUserIdentity()
        } else {
            setLoading(false)
        }
    }, [isConnected, address])

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
                // Reset forms
                setAchievementForm({ title: '', description: '', points: '', priceImpact: '' })
                setGoalForm({ title: '', description: '', deadline: '', targetValue: '', rewardPoints: '', penaltyPoints: '', priceBonus: '', pricePenalty: '' })
                setShowAchievementModal(false)
                setShowGoalModal(false)
                checkUserIdentity()
            }

            setTimeout(() => {
                refreshPortfolio()
            }, 3000)
        }
    }, [isConfirmed, hash, isListing])

    const handleIdentityCreated = (newIdentity: any) => {
        console.log('Identity created callback triggered:', newIdentity)
        setIdentity({
            ...newIdentity,
            lastUpdate: Date.now()
        })
        setShowCreateForm(false)
        setCreating(false)
        toast.success('Identity created successfully!')

        setTimeout(() => {
            console.log('Refreshing identity data after creation...')
            checkUserIdentity()
        }, 3000)
    }

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

                        <div className="mt-8 space-y-4">
                            <WalletDebugComponent />
                            <NetworkSwitcher />
                        </div>
                    </motion.div>
                </div>
            </div>
        )
    }

    // Create form state
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

                        <div className="mt-8 space-y-4">
                            <WalletDebugComponent />
                            <NetworkSwitcher />
                        </div>
                    </motion.div>
                </div>
            </div>
        )
    }

    // Main enhanced dashboard view
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
                                Welcome back, {userProfile?.username || identity?.username || 'User'}!
                            </h1>
                            <p className="text-xl text-gray-600">
                                Your enhanced NFT with dynamic pricing on Somnia Network
                            </p>

                            {/* Enhanced info display */}
                            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white p-3 rounded-lg shadow-sm">
                                    <div className="text-sm text-gray-500">Base Price</div>
                                    <div className="font-bold">
                                        {Number(identity.basePrice || 0.001).toFixed(4)} STT
                                    </div>
                                </div>
                                <div className="bg-white p-3 rounded-lg shadow-sm">
                                    <div className="text-sm text-gray-500">Current Price</div>
                                    <div className="font-bold text-green-600">
                                        {Number(identity.currentPrice || 0.001).toFixed(4)} STT
                                    </div>
                                </div>
                                <div className="bg-white p-3 rounded-lg shadow-sm">
                                    <div className="text-sm text-gray-500">Price Change</div>
                                    <div className={`font-bold ${identity.currentPrice > identity.basePrice ? 'text-green-600' : 'text-red-600'}`}>
                                        {identity.currentPrice > identity.basePrice ? '+' : ''}{(((identity.currentPrice - identity.basePrice) / identity.basePrice) * 100).toFixed(1)}%
                                    </div>
                                </div>
                                <div className="bg-white p-3 rounded-lg shadow-sm">
                                    <div className="text-sm text-gray-500">Goals</div>
                                    <div className="font-bold">{identity.profile?.goals?.length || 0} Active</div>
                                </div>
                            </div>
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
                                score={identity.profile?.goals?.length || 0}
                                level={identity.skillLevel}
                                title="Active Goals"
                                subtitle={identity.primarySkill}
                                icon={Target}
                                gradient="from-green-500 to-teal-500"
                            />
                        </div>

                        <ProfileSection identity={identity} />

                        {/* Goals Section */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">Your Goals</h2>
                                <button
                                    onClick={() => setShowGoalModal(true)}
                                    className="bg-green-50 text-green-600 px-4 py-2 rounded-xl hover:bg-green-100 transition-colors"
                                >
                                    Set New Goal
                                </button>
                            </div>

                            {identity.profile?.goals && identity.profile.goals.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {identity.profile.goals.map((goal, index) => (
                                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="font-semibold">{goal.title}</h3>
                                                <div className={`px-2 py-1 rounded text-xs ${goal.completed ? 'bg-green-100 text-green-600' :
                                                    goal.failed ? 'bg-red-100 text-red-600' :
                                                        'bg-yellow-100 text-yellow-600'
                                                    }`}>
                                                    {goal.completed ? 'Completed' : goal.failed ? 'Failed' : 'Active'}
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-600 mb-2">{goal.description}</p>
                                            <div className="text-sm">
                                                <div>Progress: {goal.currentValue}/{goal.targetValue}</div>
                                                <div>Deadline: {new Date(goal.deadline * 1000).toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-500 mb-4">No goals set yet</p>
                                    <button
                                        onClick={() => setShowGoalModal(true)}
                                        className="bg-gradient-to-r from-green-600 to-teal-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300"
                                    >
                                        Set Your First Goal
                                    </button>
                                </div>
                            )}
                        </motion.div>

                        {/* Enhanced Achievements Section */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">Achievements & Price Impact</h2>
                                <button
                                    onClick={() => setShowAchievementModal(true)}
                                    className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl hover:bg-blue-100 transition-colors"
                                >
                                    Add Achievement
                                </button>
                            </div>

                            {identity.profile?.achievements && identity.profile.achievements.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {identity.profile.achievements.slice(0, 6).map((achievement, index) => (
                                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                                            <h3 className="font-semibold mb-1">{achievement.title}</h3>
                                            <p className="text-sm text-gray-600 mb-2">{achievement.description}</p>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-blue-600">+{achievement.points} pts</span>
                                                <span className="text-green-600">+{achievement.priceImpact}bp price</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-500 mb-4">No achievements yet</p>
                                    <button
                                        onClick={() => setShowAchievementModal(true)}
                                        className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300"
                                    >
                                        Add Your First Achievement
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
                                <button className="w-full flex items-center space-x-3 p-3 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors">
                                    <Search className="w-5 h-5 text-purple-600" />
                                    <span className="font-medium text-purple-700">Explore Market</span>
                                </button>
                                <button
                                    onClick={monitorNetworkGas}
                                    className="w-full flex items-center space-x-3 p-3 bg-green-50 rounded-xl hover:bg-green-100 transition-colors"
                                >
                                    <TrendingUp className="w-5 h-5 text-green-600" />
                                    <span className="font-medium text-green-700">Check Network Gas</span>
                                </button>
                                <button
                                    onClick={refreshPortfolio}
                                    className="w-full flex items-center space-x-3 p-3 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors"
                                >
                                    <RefreshCw className="w-5 h-5 text-indigo-600" />
                                    <span className="font-medium text-indigo-700">Force Refresh</span>
                                </button>
                            </div>
                            <SyncStatus />
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
                                    <span className="font-semibold">#{realTokenId || identity.tokenId}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Network</span>
                                    <span className="font-semibold">Somnia</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Status</span>
                                    <span className="font-semibold text-green-600">
                                        {identity && identity.tokenId ? 'Verified' : 'Pending'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Type</span>
                                    <span className="text-sm text-green-600 font-semibold">Enhanced</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Price Multiplier</span>
                                    <span className="text-sm font-semibold">{(identity.priceMultiplier / 100).toFixed(1)}x</span>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 }}
                            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                        >
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Debug Tools</h3>
                            <div className="space-y-4">
                                <PriceDebugger />
                                <WalletDebugComponent />
                                <NetworkSwitcher />
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

                                <div className="bg-blue-50 p-3 rounded-lg">
                                    <p className="text-blue-800 text-sm">
                                        Price Impact: 100 basis points = 1% price increase
                                    </p>
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

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Reward Points</label>
                                        <input
                                            type="number"
                                            value={goalForm.rewardPoints}
                                            onChange={(e) => setGoalForm({ ...goalForm, rewardPoints: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            placeholder="100"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Penalty Points</label>
                                        <input
                                            type="number"
                                            value={goalForm.penaltyPoints}
                                            onChange={(e) => setGoalForm({ ...goalForm, penaltyPoints: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            placeholder="50"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Price Bonus (bp)</label>
                                        <input
                                            type="number"
                                            value={goalForm.priceBonus}
                                            onChange={(e) => setGoalForm({ ...goalForm, priceBonus: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            placeholder="200"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Price Penalty (bp)</label>
                                        <input
                                            type="number"
                                            value={goalForm.pricePenalty}
                                            onChange={(e) => setGoalForm({ ...goalForm, pricePenalty: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            placeholder="100"
                                        />
                                    </div>
                                </div>

                                <div className="bg-green-50 p-3 rounded-lg">
                                    <p className="text-green-800 text-sm">
                                        Complete the goal by deadline to earn rewards and price bonus.
                                        Failure results in penalties.
                                    </p>
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
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Price (STT)
                                </label>
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
                                    Current NFT value: {Number(identity.currentPrice || 0.001).toFixed(4)} STT
                                </p>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                <p className="text-blue-800 text-sm">
                                    <strong>Enhanced NFT:</strong> Dynamic pricing based on achievements and goals
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
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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