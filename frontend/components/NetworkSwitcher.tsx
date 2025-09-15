'use client'

import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { useEffect, useState } from 'react'
import { somniaTestnet } from '@/utils/wagmi'
import toast from 'react-hot-toast'

export function NetworkSwitcher() {
    const { isConnected } = useAccount()
    const chainId = useChainId()
    const { switchChain, isPending } = useSwitchChain()
    const [hasChecked, setHasChecked] = useState(false)

    const isCorrectNetwork = chainId === somniaTestnet.id

    useEffect(() => {
        if (isConnected && !hasChecked) {
            setHasChecked(true)

            if (!isCorrectNetwork) {
                toast.error('Please switch to Somnia Testnet')
            }
        }
    }, [isConnected, isCorrectNetwork, hasChecked])

    const handleSwitchNetwork = async () => {
        try {
            await switchChain({ chainId: somniaTestnet.id })
            toast.success('Switched to Somnia Testnet')
        } catch (error: any) {
            console.error('Network switch error:', error)

            // Try to add the network to MetaMask
            if (error?.code === 4902 || error?.message?.includes('Unrecognized chain ID')) {
                try {
                    await window.ethereum?.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: `0x${somniaTestnet.id.toString(16)}`,
                            chainName: somniaTestnet.name,
                            nativeCurrency: somniaTestnet.nativeCurrency,
                            rpcUrls: [somniaTestnet.rpcUrls.default.http[0]],
                            blockExplorerUrls: [somniaTestnet.blockExplorers.default.url],
                        }],
                    })
                    toast.success('Somnia Testnet added to MetaMask')
                } catch (addError) {
                    console.error('Add network error:', addError)
                    toast.error('Failed to add Somnia Testnet to MetaMask')
                }
            } else {
                toast.error('Failed to switch network')
            }
        }
    }

    if (!isConnected) {
        return null
    }

    if (isCorrectNetwork) {
        return (
            <div className="flex items-center gap-2 text-green-600 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Somnia Testnet
            </div>
        )
    }

    return (
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-orange-600 text-sm">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                Wrong Network
            </div>
            <button
                onClick={handleSwitchNetwork}
                disabled={isPending}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
            >
                {isPending ? 'Switching...' : 'Switch to Somnia'}
            </button>
        </div>
    )
}