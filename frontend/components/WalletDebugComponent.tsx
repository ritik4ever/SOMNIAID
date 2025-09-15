'use client'

import { useAccount, useChainId, useReadContract, useWriteContract } from 'wagmi'
import { parseEther } from 'viem'
import { useState, useEffect } from 'react'
import { CONTRACT_ABI } from '@/utils/contract'
import { ChevronUp, ChevronDown, X } from 'lucide-react'
import toast from 'react-hot-toast'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`

export function WalletDebugComponent() {
    const { isConnected, address, connector } = useAccount()
    const chainId = useChainId()
    const [debugInfo, setDebugInfo] = useState<any>({})
    const [databaseStatus, setDatabaseStatus] = useState<any>(null)
    const [showWriteOps, setShowWriteOps] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)
    const [isVisible, setIsVisible] = useState(true)

    // READ-ONLY contract calls
    const { data: hasIdentity, refetch: refetchHasIdentity } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'hasIdentity',
        args: address ? [address] : undefined,
        query: { enabled: !!address && !!CONTRACT_ADDRESS }
    })

    const { data: tokenId, refetch: refetchTokenId } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getTokenIdByAddress',
        args: address ? [address] : undefined,
        query: { enabled: !!address && !!hasIdentity }
    })

    const { data: identity, refetch: refetchIdentity } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getIdentity',
        args: tokenId ? [tokenId] : undefined,
        query: { enabled: !!tokenId }
    })

    const { data: totalIdentities } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getTotalIdentities',
        query: { enabled: !!CONTRACT_ADDRESS }
    })

    // WRITE contract calls (conditional)
    const { writeContract, data: hash, isPending, error } = useWriteContract()

    useEffect(() => {
        const info = {
            isConnected,
            address,
            chainId,
            connector: connector?.name,
            contractAddress: CONTRACT_ADDRESS,
            environment: process.env.NODE_ENV,
            apiUrl: process.env.NEXT_PUBLIC_API_URL,
            walletConnectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ? 'Set' : 'Missing',
            currentUrl: typeof window !== 'undefined' ? window.location.href : 'SSR'
        }
        setDebugInfo(info)
    }, [isConnected, address, chainId, connector])

    const refreshContractData = async () => {
        try {
            await Promise.all([
                refetchHasIdentity(),
                refetchTokenId(),
                refetchIdentity()
            ])
            toast.success('Contract data refreshed!')
        } catch (err: any) {
            console.error('Refresh error:', err)
            toast.error('Failed to refresh data')
        }
    }

    const testApiConnection = async () => {
        try {
            const response = await fetch(`${debugInfo.apiUrl || '/api'}/test`)
            const data = await response.json()

            if (data.success) {
                toast.success('API connection working!')
                console.log('API test response:', data)
            } else {
                throw new Error('API test failed')
            }
        } catch (err: any) {
            console.error('API test error:', err)
            toast.error('API connection failed')
        }
    }

    const checkDatabaseStatus = async () => {
        if (!tokenId) {
            toast.error('No token ID found')
            return
        }

        try {
            const response = await fetch(`${debugInfo.apiUrl || '/api'}/identity/${tokenId}`)
            const data = await response.json()

            if (data.success) {
                setDatabaseStatus(data.data)
                toast.success(`Database status: ${data.data.isVerified ? 'VERIFIED' : 'PENDING'}`)
                console.log('Database identity:', data.data)
            } else {
                throw new Error('Database check failed')
            }
        } catch (err: any) {
            console.error('Database check error:', err)
            toast.error('Database check failed')
        }
    }

    // SAFE write operation - only if no identity exists
    const testCreateIdentity = async () => {
        if (hasIdentity) {
            toast.error('Identity already exists! Cannot create duplicate.')
            return
        }

        const confirmed = window.confirm('This will create a test identity on the blockchain. Proceed?')
        if (!confirmed) return

        try {
            const testUsername = `test_${Math.random().toString(36).substr(2, 6)}`

            writeContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'createIdentity',
                args: [testUsername, 'Test Skill'],
            })

            toast.loading('Creating test identity...')
        } catch (err: any) {
            console.error('Test create error:', err)
            toast.error(`Failed to create test identity: ${err.message}`)
        }
    }

    const testListIdentity = async () => {
        if (!hasIdentity || !tokenId) {
            toast.error('No identity found to list')
            return
        }

        const price = prompt('Enter price in STT (e.g., 10.5):')
        if (!price || parseFloat(price) <= 0) {
            toast.error('Invalid price')
            return
        }

        try {
            writeContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'listIdentity',
                args: [BigInt(tokenId), parseEther(price)]
            })
            toast.loading('Listing identity...')
        } catch (err: any) {
            console.error('List error:', err)
            toast.error(`Failed to list: ${err.message}`)
        }
    }

    if (!isVisible) return null

    return (
        <div className="fixed bottom-4 right-4 z-50">
            {/* Collapsed State */}
            {!isExpanded && (
                <button
                    onClick={() => setIsExpanded(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 flex items-center gap-2"
                >
                    <span>Debug</span>
                    <ChevronUp className="w-4 h-4" />
                </button>
            )}

            {/* Expanded State */}
            {isExpanded && (
                <div className="bg-white border-2 border-gray-300 rounded-lg p-4 shadow-xl max-w-sm text-xs max-h-96 overflow-y-auto">
                    {/* Header with controls */}
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-sm">Wallet Debug Info</h3>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <ChevronDown className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setIsVisible(false)}
                                className="p-1 hover:bg-gray-100 rounded text-red-500"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1 mb-3">
                        <div className="flex justify-between">
                            <span>Connected:</span>
                            <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
                                {isConnected ? 'Yes' : 'No'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Address:</span>
                            <span className="truncate max-w-20">{address?.slice(0, 6)}...{address?.slice(-4) || 'None'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Chain ID:</span>
                            <span className={chainId === 50312 ? 'text-green-600' : 'text-orange-600'}>
                                {chainId || 'None'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Contract:</span>
                            <span className={CONTRACT_ADDRESS ? 'text-green-600' : 'text-red-600'}>
                                {CONTRACT_ADDRESS ? 'Set' : 'Missing'}
                            </span>
                        </div>
                    </div>

                    {isConnected && (
                        <>
                            <div className="border-t pt-2 mb-3">
                                <div className="font-medium mb-1">Contract Data:</div>
                                <div className="space-y-1">
                                    <div className="flex justify-between">
                                        <span>Has Identity:</span>
                                        <span className={hasIdentity ? 'text-green-600' : 'text-red-600'}>
                                            {hasIdentity ? 'Yes' : 'No'}
                                        </span>
                                    </div>
                                    {hasIdentity && tokenId && (
                                        <div className="flex justify-between">
                                            <span>Token ID:</span>
                                            <span className="text-blue-600">#{tokenId.toString()}</span>
                                        </div>
                                    )}
                                    {identity && (
                                        <>
                                            <div className="flex justify-between">
                                                <span>Reputation:</span>
                                                <span>{identity.reputationScore?.toString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Skill Level:</span>
                                                <span>{identity.skillLevel?.toString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Achievements:</span>
                                                <span>{identity.achievementCount?.toString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Primary Skill:</span>
                                                <span className="truncate max-w-16">{identity.primarySkill}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Verified:</span>
                                                <span className={identity.isVerified ? 'text-green-600' : 'text-orange-600'}>
                                                    {identity.isVerified ? 'Yes' : 'No'}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                    <div className="flex justify-between">
                                        <span>Total Identities:</span>
                                        <span>{totalIdentities?.toString() || '0'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* READ Operations */}
                            <div className="space-y-2 mb-3">
                                <div className="font-medium text-blue-700">READ Operations:</div>
                                <button
                                    onClick={refreshContractData}
                                    className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                                >
                                    Refresh Contract Data
                                </button>

                                <button
                                    onClick={testApiConnection}
                                    className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                                >
                                    Test API Connection
                                </button>

                                {hasIdentity && (
                                    <button
                                        onClick={checkDatabaseStatus}
                                        className="w-full px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs"
                                    >
                                        Check Database Status
                                    </button>
                                )}
                            </div>

                            {/* WRITE Operations - Conditional */}
                            <div className="border-t pt-2">
                                <button
                                    onClick={() => setShowWriteOps(!showWriteOps)}
                                    className="w-full px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs mb-2"
                                >
                                    {showWriteOps ? 'Hide' : 'Show'} WRITE Operations ⚠️
                                </button>

                                {showWriteOps && (
                                    <div className="space-y-2">
                                        <div className="text-red-600 text-xs font-medium">⚠️ Blockchain Transactions:</div>

                                        {!hasIdentity ? (
                                            <button
                                                onClick={testCreateIdentity}
                                                disabled={isPending}
                                                className="w-full px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-xs"
                                            >
                                                {isPending ? 'Creating...' : 'Create Test Identity'}
                                            </button>
                                        ) : (
                                            <div className="text-gray-500 text-xs p-2 bg-gray-100 rounded">
                                                Identity exists - Create disabled
                                            </div>
                                        )}

                                        {hasIdentity && (
                                            <button
                                                onClick={testListIdentity}
                                                disabled={isPending}
                                                className="w-full px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 text-xs"
                                            >
                                                {isPending ? 'Listing...' : 'List Identity for Sale'}
                                            </button>
                                        )}

                                        {hash && (
                                            <div className="text-green-600 text-xs">
                                                TX: {hash.slice(0, 10)}...
                                            </div>
                                        )}

                                        {error && (
                                            <div className="text-red-600 text-xs">
                                                Error: {error.message}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {databaseStatus && (
                                <div className="border-t pt-2 mt-2">
                                    <div className="font-medium mb-1 text-xs">Database Status:</div>
                                    <div className="space-y-1 text-xs">
                                        <div className="flex justify-between">
                                            <span>Status:</span>
                                            <span className={databaseStatus.isVerified ? 'text-green-600' : 'text-orange-600'}>
                                                {databaseStatus.isVerified ? 'VERIFIED' : 'PENDING'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>TX Hash:</span>
                                            <span className={databaseStatus.txHash ? 'text-green-600' : 'text-red-600'}>
                                                {databaseStatus.txHash ? 'Present' : 'Missing'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Reputation:</span>
                                            <span>{databaseStatus.reputationScore || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="text-gray-500">
                            Environment: {debugInfo.environment}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}