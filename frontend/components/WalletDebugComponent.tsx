'use client'

import { useAccount, useChainId, useWriteContract } from 'wagmi'
import { useState, useEffect } from 'react'
import { CONTRACT_ABI } from '@/utils/contract'
import toast from 'react-hot-toast'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`

export function WalletDebugComponent() {
    const { isConnected, address, connector } = useAccount()
    const chainId = useChainId()
    const { writeContract, data: hash, isPending, error } = useWriteContract()
    const [debugInfo, setDebugInfo] = useState<any>({})

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
        console.log('Wallet Debug Info:', info)
    }, [isConnected, address, chainId, connector])

    const testContractCall = async () => {
        if (!isConnected || !address) {
            toast.error('Wallet not connected')
            return
        }

        try {
            console.log('Testing contract call...')
            const result = writeContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'createIdentity',
                args: ['debugtest', 'test skill'],
            })
            console.log('Contract call result:', result)
            toast.success('Contract call initiated!')
        } catch (err: any) {
            console.error('Contract call error:', err)
            toast.error(`Contract call failed: ${err.message}`)
        }
    }

    return (
        <div className="fixed bottom-4 right-4 bg-white border-2 border-gray-300 rounded-lg p-4 shadow-lg max-w-sm text-xs">
            <h3 className="font-bold mb-2 text-sm">Wallet Debug Info</h3>

            <div className="space-y-1 mb-3">
                <div className="flex justify-between">
                    <span>Connected:</span>
                    <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
                        {isConnected ? 'Yes' : 'No'}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span>Address:</span>
                    <span className="truncate max-w-20">{address || 'None'}</span>
                </div>
                <div className="flex justify-between">
                    <span>Chain ID:</span>
                    <span className={chainId === 50312 ? 'text-green-600' : 'text-orange-600'}>
                        {chainId || 'None'}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span>Connector:</span>
                    <span>{connector?.name || 'None'}</span>
                </div>
                <div className="flex justify-between">
                    <span>Contract:</span>
                    <span className={CONTRACT_ADDRESS ? 'text-green-600' : 'text-red-600'}>
                        {CONTRACT_ADDRESS ? 'Set' : 'Missing'}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span>API URL:</span>
                    <span className={debugInfo.apiUrl ? 'text-green-600' : 'text-red-600'}>
                        {debugInfo.apiUrl ? 'Set' : 'Missing'}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span>WC Project ID:</span>
                    <span className={debugInfo.walletConnectId === 'Set' ? 'text-green-600' : 'text-red-600'}>
                        {debugInfo.walletConnectId}
                    </span>
                </div>
            </div>

            {isConnected && (
                <div className="space-y-2">
                    <button
                        onClick={testContractCall}
                        disabled={isPending}
                        className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isPending ? 'Testing...' : 'Test Contract Call'}
                    </button>

                    {hash && (
                        <div className="text-green-600">
                            TX: {hash.slice(0, 10)}...
                        </div>
                    )}

                    {error && (
                        <div className="text-red-600">
                            Error: {error.message}
                        </div>
                    )}
                </div>
            )}

            <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="text-gray-500">
                    Environment: {debugInfo.environment}
                </div>
            </div>
        </div>
    )
}