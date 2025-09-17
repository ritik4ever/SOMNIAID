'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { readContract, getGasPrice, estimateGas } from 'wagmi/actions'
import { formatEther, parseEther, formatGwei, parseGwei } from 'viem'
import { motion } from 'framer-motion'
import { User, Zap, Trophy, Plus, Search, TrendingUp, ExternalLink, Tag, RefreshCw } from 'lucide-react'
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
import { useNFTEventSync } from '@/hooks/useNFTSync'
import { config } from '@/utils/wagmi'
// Updated imports for gas estimation
import {
    getSomniaGasConfig,
    getEmergencyGasConfig,
    debugContractState,
    getAutoGasConfig,
    formatGasConfig,
    type LegacyGasConfig
} from '@/utils/gasEstimation'

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
    ownerAddress?: string
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
    source?: string
    dbSynced?: boolean
}

export default function DashboardPage() {
    const { address, isConnected } = useAccount()
    const [identity, setIdentity] = useState<UserIdentity | null>(null)
    const [loading, setLoading] = useState(true)
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [creating, setCreating] = useState(false)
    const [realTokenId, setRealTokenId] = useState<number | null>(null)

    // Listing modal state
    const [showListModal, setShowListModal] = useState(false)
    const [listPrice, setListPrice] = useState('')
    const [isListing, setIsListing] = useState(false)

    // Get real-time STT price
    const { price: sttUsdPrice, loading: priceLoading, error: priceError, lastUpdated, refreshPrice } = useTokenPrice('stt')

    const { writeContract, data: hash, error, isPending } = useWriteContract()
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })

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

    // Check if marketplace is approved
    const checkMarketplaceApproval = async (): Promise<boolean> => {
        try {
            if (!address) return false

            const isApproved = await readContract(config, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'isApprovedForAll',
                args: [address as `0x${string}`, CONTRACT_ADDRESS]
            }) as boolean

            console.log('Marketplace approval status:', isApproved)
            return isApproved
        } catch (error) {
            console.error('Failed to check approval:', error)
            return false
        }
    }

    // Auto gas detection approach - let the network decide
    const approveMarketplaceAuto = async (): Promise<boolean> => {
        try {
            if (!address) return false

            toast.loading('Using auto gas detection...')

            console.group('🤖 AUTO GAS DETECTION')
            console.log('Letting network determine optimal gas prices...')

            // Method 1: Pure auto detection - no gas parameters
            await writeContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'setApprovalForAll',
                args: [CONTRACT_ADDRESS, true],
                // NO GAS PARAMETERS = Auto detection
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

            // If auto detection fails, try with minimal gas hint
            return await approveMarketplaceWithHint()
        }
    }

    const approveMarketplaceWithHint = async (): Promise<boolean> => {
        try {
            toast.loading('Auto detection failed, trying with gas hint...')

            console.group('🔍 AUTO + HINT APPROACH')

            // Get current network gas price and multiply by 3 for reliability
            const currentGasPrice = await getGasPrice(config)
            const suggestedGasPrice = BigInt(Math.floor(Number(currentGasPrice) * 3))

            console.log('Current network gas price:', formatGwei(currentGasPrice), 'gwei')
            console.log('Suggested gas price (3x):', formatGwei(suggestedGasPrice), 'gwei')

            // Estimate gas for this specific call
            const contractCall = {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'setApprovalForAll',
                args: [CONTRACT_ADDRESS, true],
                account: address as `0x${string}`,
            }

            const estimatedGas = await estimateGas(config, contractCall)
            const gasWithBuffer = BigInt(Math.floor(Number(estimatedGas) * 1.2))

            console.log('Estimated gas:', estimatedGas.toString())
            console.log('Gas with buffer:', gasWithBuffer.toString())

            // Use auto-detected values with minimal override
            await writeContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'setApprovalForAll',
                args: [CONTRACT_ADDRESS, true],
                gas: gasWithBuffer, // Use estimated gas
                gasPrice: suggestedGasPrice, // Use network price * 3
            })

            console.log('✅ Auto + hint transaction submitted')
            console.groupEnd()

            toast.dismiss()
            toast.success('Approval with gas hint submitted!')

            return true
        } catch (error: any) {
            console.groupEnd()
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

            console.group('🤖 AUTO LIST WITH SMART DETECTION')

            // Step 1: Get token ID
            const blockchainTokenId = await getBlockchainTokenId(address)
            if (!blockchainTokenId) {
                throw new Error('No NFT found for your address')
            }

            // Step 2: Check approval with auto retry
            const isApproved = await checkMarketplaceApproval()

            if (!isApproved) {
                toast.dismiss()
                toast.loading('Auto-approving marketplace...')

                const approvalSuccess = await approveMarketplaceAuto()
                if (!approvalSuccess) {
                    throw new Error('Auto approval failed')
                }

                toast.dismiss()
                toast.success('Auto approval submitted! Wait for confirmation, then try listing again.')
                setIsListing(false)
                console.groupEnd()
                return
            }

            // Step 3: Auto-detected listing
            const priceInWei = parseEther(listPrice)

            toast.dismiss()
            toast.loading('Auto-detecting optimal gas for listing...')

            console.log('Using auto gas detection for listing...')

            // Try pure auto detection first
            try {
                await writeContract({
                    address: CONTRACT_ADDRESS,
                    abi: CONTRACT_ABI,
                    functionName: 'listIdentity',
                    args: [BigInt(blockchainTokenId), priceInWei],
                    // Pure auto detection - no gas parameters
                })

                console.log('✅ Auto listing submitted successfully')
            } catch (autoError) {
                console.log('Pure auto failed, trying with network hint...')

                // Fallback: Use network gas price + buffer
                const networkGasPrice = await getGasPrice(config)
                const bufferedGasPrice = BigInt(Math.floor(Number(networkGasPrice) * 2))

                await writeContract({
                    address: CONTRACT_ADDRESS,
                    abi: CONTRACT_ABI,
                    functionName: 'listIdentity',
                    args: [BigInt(blockchainTokenId), priceInWei],
                    gasPrice: bufferedGasPrice, // Only set price, let gas limit auto-detect
                })

                console.log('✅ Auto + hint listing submitted')
            }

            toast.dismiss()
            toast.loading('Listing submitted with auto gas! Waiting for confirmation...')
            console.groupEnd()

        } catch (error: any) {
            console.error('Auto listing failed:', error)
            console.groupEnd()
            setIsListing(false)
            toast.dismiss()

            if (error.message?.includes('Auto approval failed')) {
                toast.error('Please approve the marketplace first')
            } else if (error.code === 4001) {
                toast.error('Transaction cancelled')
            } else {
                toast.error(`Auto listing failed: ${error.message}`)
            }
        }
    }

    // Network gas price monitoring
    const monitorNetworkGas = async () => {
        try {
            console.group('📊 NETWORK GAS MONITORING')

            const currentPrice = await getGasPrice(config)
            console.log('Current network gas price:', formatGwei(currentPrice), 'gwei')

            // Check if network price is reasonable
            const priceInGwei = Number(formatGwei(currentPrice))

            if (priceInGwei < 1) {
                console.warn('⚠️ Network gas price very low:', priceInGwei, 'gwei')
                console.log('Suggesting minimum 10 gwei for reliability')
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

    // Add this debug function to check actual blockchain state
    const debugPurchaseState = async (tokenId: number, buyerAddress: string, sellerAddress: string) => {
        try {
            console.group('🔍 PURCHASE STATE DEBUG')

            // Check current owner
            const currentOwner = await readContract(config, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'ownerOf',
                args: [BigInt(tokenId)]
            })

            console.log('Token ID:', tokenId)
            console.log('Current owner on blockchain:', currentOwner)
            console.log('Expected buyer:', buyerAddress)
            console.log('Expected seller:', sellerAddress)
            console.log('Ownership transferred correctly:', (currentOwner as string).toLowerCase() === buyerAddress.toLowerCase())

            // Check address mappings
            const buyerTokenId = await readContract(config, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getTokenIdByAddress',
                args: [buyerAddress as `0x${string}`]
            })

            const sellerTokenId = await readContract(config, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getTokenIdByAddress',
                args: [sellerAddress as `0x${string}`]
            })

            console.log('Buyer address mapping result:', buyerTokenId)
            console.log('Seller address mapping result:', sellerTokenId)

            // Check if still listed
            const [isListed, price] = await readContract(config, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getListingInfo',
                args: [BigInt(tokenId)]
            }) as [boolean, bigint]

            console.log('Token still listed:', isListed)
            console.log('Listing price:', formatEther(price), 'STT')

            console.groupEnd()

        } catch (error) {
            console.error('Purchase state debug failed:', error)
            console.groupEnd()
        }
    }

    // Check if seller received payment
    const checkPaymentTransfer = async (sellerAddress: string, transactionHash: string) => {
        try {
            console.group('💰 PAYMENT VERIFICATION')

            console.log('Checking payment transfer for seller:', sellerAddress)
            console.log('Transaction hash:', transactionHash)

            // Note: Full payment verification would require additional RPC calls
            // This is a basic structure for payment verification

            console.groupEnd()

            toast.success('Payment verification logged to console')

        } catch (error) {
            console.error('Payment verification failed:', error)
            console.groupEnd()
        }
    }

    // Make sure your portfolio component refetches data
    const refreshPortfolio = async () => {
        // Force refresh identity data
        await checkUserIdentity()

        // Clear any cached data and update UI state
        toast.success(`Portfolio refreshed! ${isListening ? '🔄 Live sync active' : ''}`)
    }

    // ADD this sync status component:
    const SyncStatus = () => (
        <div className="text-xs text-gray-500 flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-400' : 'bg-gray-400'}`} />
            <span>{isListening ? 'Live sync' : 'Offline'}</span>
        </div>
    )

    // Also add this debug function to test gas estimation
    const debugGasEstimation = async () => {
        try {
            if (!address) return

            console.group('🔍 GAS ESTIMATION DEBUG')

            // Test simple gas config
            const testConfig = {
                gas: BigInt(200000),
                gasPrice: parseGwei('300')
            }

            console.log('Test gas config:')
            console.log('- gas:', testConfig.gas.toString())
            console.log('- gasPrice (bigint):', testConfig.gasPrice.toString())
            console.log('- gasPrice (gwei):', formatGwei(testConfig.gasPrice))
            console.log('- gasPrice (ether):', formatEther(testConfig.gasPrice))

            // Test network gas price
            try {
                const networkGasPrice = await getGasPrice(config)
                console.log('Network gas price:', formatGwei(networkGasPrice), 'gwei')
            } catch (e) {
                console.log('Could not get network gas price:', e)
            }

            // Test contract call estimation
            try {
                const contractCall = {
                    address: CONTRACT_ADDRESS,
                    abi: CONTRACT_ABI,
                    functionName: 'setApprovalForAll',
                    args: [CONTRACT_ADDRESS, true],
                    account: address as `0x${string}`,
                }

                const estimatedGas = await estimateGas(config, contractCall)
                console.log('Estimated gas for approval:', estimatedGas.toString())
            } catch (e) {
                console.log('Gas estimation failed:', e)
            }

            console.groupEnd()

            toast.success('Gas debug complete - check console')

        } catch (error) {
            console.error('Gas debug failed:', error)
            console.groupEnd()
        }
    }

    // Assign auto functions
    const approveMarketplace = approveMarketplaceAuto
    const handleListForSale = handleListForSaleAuto

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

    // FIXED: Enhanced identity checking that works for any user
    const checkUserIdentity = async () => {
        try {
            setLoading(true)

            if (!address) {
                console.log('No wallet address available')
                setShowCreateForm(true)
                return
            }

            console.group('Identity Check for Address:', address)

            // Step 1: Try blockchain-first lookup via API (works for any address)
            try {
                console.log('Step 1: Attempting blockchain API lookup...')
                const blockchainResponse = await api.getIdentityBlockchain(address)

                if (blockchainResponse.success && blockchainResponse.identity) {
                    console.log('✅ Identity found via blockchain API')
                    console.log('Identity data:', {
                        tokenId: blockchainResponse.identity.tokenId,
                        username: blockchainResponse.identity.username,
                        dbSynced: blockchainResponse.identity.dbSynced
                    })

                    setIdentity(blockchainResponse.identity)
                    setRealTokenId(blockchainResponse.identity.tokenId)

                    // Show appropriate messages
                    if (!blockchainResponse.identity.dbSynced) {
                        toast('Identity found on blockchain but missing database info. Some data may be limited.', {
                            icon: '⚠️',
                            duration: 4000,
                            style: {
                                background: '#fff3cd',
                                color: '#856404',
                            }
                        })
                    } else {
                        toast.success('Identity loaded successfully!')
                    }

                    console.groupEnd()
                    return
                }

                console.log('Blockchain API returned no identity')
            } catch (blockchainError: any) {
                console.log('Blockchain API lookup failed:', blockchainError.message)
            }

            // Step 2: Direct blockchain check (works for any address)
            try {
                console.log('Step 2: Direct blockchain check...')
                const blockchainTokenId = await getBlockchainTokenId(address)

                if (blockchainTokenId) {
                    console.log('✅ Found token ID on blockchain:', blockchainTokenId)
                    toast.success(`Found your NFT! Token ID: ${blockchainTokenId}`)

                    // Try to sync with database
                    try {
                        console.log('Step 3: Attempting database sync...')
                        const syncResponse = await api.syncBlockchain(address)

                        if (syncResponse.success) {
                            console.log('✅ Database sync successful')
                            toast.success('Database synced with blockchain!')

                            // Retry identity lookup after sync
                            setTimeout(() => checkUserIdentity(), 2000)
                            return
                        }
                    } catch (syncError: any) {
                        console.error('Database sync failed:', syncError)
                    }

                    // Even if sync failed, create minimal identity
                    const minimalIdentity: UserIdentity = {
                        tokenId: blockchainTokenId,
                        username: 'Loading...',
                        primarySkill: 'Unknown',
                        reputationScore: 100,
                        skillLevel: 1,
                        achievementCount: 0,
                        isVerified: true,
                        ownerAddress: address,
                        source: 'blockchain-only',
                        dbSynced: false
                    }

                    setIdentity(minimalIdentity)
                    setRealTokenId(blockchainTokenId)

                    toast('Found your NFT on blockchain! Database sync in progress...', {
                        icon: '⚠️',
                        duration: 3000
                    })

                    console.groupEnd()
                    return
                }

                console.log('No identity found on blockchain')
            } catch (directError: any) {
                console.error('Direct blockchain check failed:', directError)
            }

            // Step 3: Fallback to regular API with sync (works for any address)
            try {
                console.log('Step 3: Fallback to regular API...')
                const response = await api.getIdentities(1, 50, true) // verifyBlockchain = true

                if (response.success && response.identities) {
                    // Look for identity matching current wallet address
                    const userIdentity = response.identities.find((id: any) =>
                        id.ownerAddress?.toLowerCase() === address.toLowerCase()
                    )

                    if (userIdentity) {
                        console.log('✅ Identity found via regular API')
                        setIdentity(userIdentity)
                        setRealTokenId(userIdentity.tokenId)

                        toast.success('Identity found!')
                        console.groupEnd()
                        return
                    }
                }
            } catch (apiError: any) {
                console.error('Regular API lookup failed:', apiError)
            }

            // Step 4: No identity found anywhere - show create form
            console.log('No identity found for address:', address)
            setShowCreateForm(true)

        } catch (error: any) {
            console.error('Error in identity check:', error)

            // Show user-friendly error message
            if (error.message?.includes('contract')) {
                toast.error('Contract connection failed. Check configuration.')
            } else if (error.message?.includes('network')) {
                toast.error('Network connection failed. Check your internet.')
            } else {
                toast.error('Failed to check identity. Please try again.')
            }

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
                toast.success('Identity created successfully!')
                checkUserIdentity()
            }

            // After any successful transaction, refresh all data
            setTimeout(() => {
                refreshPortfolio()
            }, 3000) // Wait 3 seconds for blockchain to sync
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

        // Refresh to get correct blockchain data
        setTimeout(() => {
            console.log('Refreshing identity data after creation...')
            checkUserIdentity()
        }, 3000)
    }

    // Add approval status to your listing modal
    const ApprovalStatus = () => {
        const [approvalStatus, setApprovalStatus] = useState<'checking' | 'approved' | 'not_approved'>('checking')

        useEffect(() => {
            if (showListModal && address) {
                checkMarketplaceApproval().then(isApproved => {
                    setApprovalStatus(isApproved ? 'approved' : 'not_approved')
                })
            }
        }, [showListModal, address])

        if (approvalStatus === 'checking') {
            return (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                    <p className="text-gray-600 text-sm">Checking approval status...</p>
                </div>
            )
        }

        if (approvalStatus === 'not_approved') {
            return (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                    <p className="text-yellow-800 text-sm">
                        <strong>Approval Required:</strong> The marketplace needs permission to handle your NFT.
                        You'll be asked to approve this first.
                    </p>
                </div>
            )
        }

        return (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <p className="text-green-800 text-sm">
                    <strong>✅ Approved:</strong> Marketplace can handle your NFT. Ready to list!
                </p>
            </div>
        )
    }

    // Emergency listing with maximum gas settings
    const handleEmergencyGasListing = async () => {
        try {
            if (!address) return

            setIsListing(true)
            toast.loading('Trying emergency gas settings...')

            const blockchainTokenId = await getBlockchainTokenId(address)
            const priceInWei = parseEther(listPrice)

            if (!blockchainTokenId) {
                throw new Error('No NFT found')
            }

            // Use maximum gas configuration
            const emergencyGasConfig = getEmergencyGasConfig()

            console.log('🚨 Emergency gas attempt:', formatGasConfig(emergencyGasConfig))

            await writeContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'listIdentity',
                args: [BigInt(blockchainTokenId), priceInWei],
                gas: emergencyGasConfig.gas,
                gasPrice: emergencyGasConfig.gasPrice,
            })

            toast.dismiss()
            toast.loading('Emergency gas transaction submitted!')

        } catch (error: any) {
            setIsListing(false)
            toast.dismiss()
            toast.error(`Emergency attempt failed: ${error.message}`)
            console.error('Emergency gas failed:', error)
        }
    }

    // Loading state
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

                            {/* Show sync and token ID info */}
                            <div className="mt-2 space-y-1">
                                {realTokenId && identity.tokenId !== realTokenId && (
                                    <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
                                        <p className="text-green-800 text-sm">
                                            Using correct blockchain token ID #{realTokenId}
                                        </p>
                                    </div>
                                )}

                                {identity.source === 'blockchain-only' && !identity.dbSynced && (
                                    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                                        <p className="text-yellow-800 text-sm">
                                            Identity loaded from blockchain. Database sync in progress...
                                        </p>
                                    </div>
                                )}
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
                                {/* Debug button for testing gas estimation */}
                                <button
                                    onClick={debugGasEstimation}
                                    className="w-full flex items-center space-x-3 p-3 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
                                >
                                    <Zap className="w-5 h-5 text-red-600" />
                                    <span className="font-medium text-red-700">Debug Gas Estimation</span>
                                </button>
                                {/* Debug button for testing contract state */}
                                <button
                                    onClick={async () => {
                                        if (!address) return
                                        const tokenId = await getBlockchainTokenId(address)
                                        if (tokenId) {
                                            console.log('Testing contract state for token:', tokenId)
                                            await debugContractState(tokenId, address)
                                        }
                                    }}
                                    className="w-full flex items-center space-x-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                                >
                                    <Zap className="w-5 h-5 text-gray-600" />
                                    <span className="font-medium text-gray-700">Debug Contract</span>
                                </button>
                                {/* Debug button for purchase state */}
                                <button
                                    onClick={async () => {
                                        if (!address) return
                                        const tokenId = await getBlockchainTokenId(address)
                                        if (tokenId) {
                                            // Example debug - replace with actual buyer/seller addresses as needed
                                            await debugPurchaseState(tokenId, address, address)
                                        }
                                    }}
                                    className="w-full flex items-center space-x-3 p-3 bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors"
                                >
                                    <Trophy className="w-5 h-5 text-orange-600" />
                                    <span className="font-medium text-orange-700">Debug Purchase State</span>
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
                                    <span className={`font-semibold ${identity.isVerified ? 'text-green-600' : 'text-yellow-600'}`}>
                                        {identity.isVerified ? 'Verified' : 'Pending'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Data Source</span>
                                    <span className={`text-sm ${identity.dbSynced ? 'text-green-600' : 'text-yellow-600'}`}>
                                        {identity.dbSynced ? 'Database Synced' : 'Blockchain Only'}
                                    </span>
                                </div>
                            </div>
                        </motion.div>

                        <ActivityFeed />

                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 }}
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

                {/* Listing Modal */}
                {showListModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">List Identity for Sale</h3>

                            {/* Approval Status Component */}
                            <ApprovalStatus />

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
                                {priceLoading ? (
                                    <p className="text-xs text-gray-500 mt-1">Loading USD price...</p>
                                ) : priceError ? (
                                    <p className="text-xs text-red-500 mt-1">Unable to fetch USD price</p>
                                ) : (
                                    <p className="text-xs text-gray-500 mt-1">
                                        ~${(parseFloat(listPrice || '0') * sttUsdPrice).toFixed(4)} USD
                                        <span className="ml-2 text-gray-400">
                                            (1 STT = ${sttUsdPrice.toFixed(4)})
                                        </span>
                                    </p>
                                )}
                            </div>

                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                                <p className="text-green-800 text-sm">
                                    <strong>Ready to List:</strong> Using blockchain token ID #{realTokenId || identity.tokenId}
                                </p>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                <p className="text-blue-800 text-sm">
                                    <strong>Auto Gas Detection:</strong> Network will determine optimal gas prices
                                </p>
                            </div>

                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                                <p className="text-yellow-800 text-sm">
                                    <strong>Two-Step Process:</strong>
                                    <br />
                                    1. Approve marketplace (if needed)
                                    <br />
                                    2. List NFT for sale
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
                                    {isListing ? 'Processing...' : 'Start Listing'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}