import React, { useState } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/utils/contract'

interface Identity {
    reputationScore: bigint
    skillLevel: bigint
    achievementCount: bigint
    lastUpdate: bigint
    primarySkill: string
    isVerified: boolean
    basePrice: bigint
    currentPrice: bigint
}

export function WalletDebugComponent() {
    const [isVisible, setIsVisible] = useState(false)
    const { address, isConnected } = useAccount()

    const { data: hasIdentity } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'hasIdentity',
        args: address ? [address] : undefined,
    })

    const { data: tokenId } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getTokenIdByAddress',
        args: address ? [address] : undefined,
    })

    const { data: identity } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getIdentity',
        args: tokenId ? [tokenId] : undefined,
    }) as { data: Identity | undefined }

    if (!isConnected || !address) return null

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <button
                onClick={() => setIsVisible(!isVisible)}
                className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700"
            >
                Debug Info
            </button>

            {isVisible && (
                <div className="absolute bottom-12 right-0 bg-white border border-gray-200 rounded-lg p-4 shadow-lg max-w-sm">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-semibold text-gray-900">Wallet Debug Info</h3>
                        <button
                            onClick={() => setIsVisible(false)}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            ×
                        </button>
                    </div>

                    <div className="space-y-2 text-xs">
                        <div>
                            <span className="text-gray-600">Connected:</span>
                            <span className="ml-2 text-green-600">{isConnected ? 'Yes' : 'No'}</span>
                        </div>

                        <div>
                            <span className="text-gray-600">Address:</span>
                            <span className="ml-2 text-blue-600">
                                {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'None'}
                            </span>
                        </div>

                        <div>
                            <span className="text-gray-600">Chain ID:</span>
                            <span className="ml-2">50312</span>
                        </div>

                        <div>
                            <span className="text-gray-600">Contract:</span>
                            <span className="ml-2 text-purple-600">Set</span>
                        </div>

                        <div>
                            <span className="text-gray-600">Has Identity:</span>
                            <span className="ml-2">{hasIdentity ? 'Yes' : 'No'}</span>
                        </div>

                        <div>
                            <span className="text-gray-600">Token ID:</span>
                            <span className="ml-2 text-blue-600">#{tokenId?.toString() || '0'}</span>
                        </div>

                        <div>
                            <span className="text-gray-600">Reputation:</span>
                            <span className="ml-2">{identity?.reputationScore?.toString() || '0'}</span>
                        </div>

                        <div>
                            <span className="text-gray-600">Skill Level:</span>
                            <span className="ml-2">{identity?.skillLevel?.toString() || '0'}</span>
                        </div>

                        <div>
                            <span className="text-gray-600">Achievements:</span>
                            <span className="ml-2">{identity?.achievementCount?.toString() || '0'}</span>
                        </div>

                        <div>
                            <span className="text-gray-600">Primary Skill:</span>
                            <span className="ml-2">{identity?.primarySkill || 'None'}</span>
                        </div>

                        <div>
                            <span className="text-gray-600">Verified:</span>
                            <span className="ml-2">{identity?.isVerified ? 'Yes' : 'No'}</span>
                        </div>

                        <div className="pt-2 border-t border-gray-200 mt-3">
                            <div className="text-green-600 text-xs">● Live sync</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}