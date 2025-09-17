import { useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { ethers } from 'ethers'
import { formatEther } from 'viem'
import toast from 'react-hot-toast'
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/utils/contract'

interface SyncCallbacks {
    onIdentityCreated?: () => void
    onIdentityPurchased?: (tokenId: number, buyer: string, seller: string, price: bigint) => void
    onReputationUpdated?: () => void
    onAchievementUnlocked?: () => void
    refreshIdentity?: () => void
}

export const useNFTEventSync = (callbacks: SyncCallbacks) => {
    const { address } = useAccount()
    const provider = useRef<ethers.JsonRpcProvider | null>(null)
    const contract = useRef<ethers.Contract | null>(null)

    // Initialize provider and contract
    useEffect(() => {
        provider.current = new ethers.JsonRpcProvider('https://dream-rpc.somnia.network/')
        contract.current = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider.current)
    }, [])

    // Event listeners for real-time updates
    useEffect(() => {
        if (!contract.current || !address) return

        const handleIdentityCreated = (tokenId: bigint, owner: string, username: string) => {
            if (owner.toLowerCase() === address.toLowerCase()) {
                console.log('New identity created for current address')
                toast.success(`Identity created: ${username}`)
                setTimeout(() => callbacks.onIdentityCreated?.(), 2000)
            }
        }

        const handleIdentityPurchased = (tokenId: bigint, buyer: string, seller: string, price: bigint) => {
            const currentAddress = address.toLowerCase()

            if (buyer.toLowerCase() === currentAddress) {
                console.log('NFT purchased by current address')
                toast.success(`NFT purchased successfully! Token #${tokenId}`)
                setTimeout(() => {
                    callbacks.refreshIdentity?.()
                    callbacks.onIdentityPurchased?.(Number(tokenId), buyer, seller, price)
                }, 2000)
            }

            if (seller.toLowerCase() === currentAddress) {
                console.log('NFT sold by current address')
                toast.success(`Your NFT sold for ${formatEther(price)} STT!`)
                setTimeout(() => {
                    callbacks.refreshIdentity?.()
                    callbacks.onIdentityPurchased?.(Number(tokenId), buyer, seller, price)
                }, 2000)
            }
        }

        const handleReputationUpdated = (tokenId: bigint, newScore: bigint) => {
            console.log('Reputation updated for token:', tokenId.toString())
            setTimeout(() => callbacks.onReputationUpdated?.(), 1000)
        }

        const handleAchievementUnlocked = (tokenId: bigint, title: string, points: bigint) => {
            console.log('Achievement unlocked for token:', tokenId.toString())
            toast.success(`Achievement unlocked: ${title} (+${points} points)`)
            setTimeout(() => callbacks.onAchievementUnlocked?.(), 1000)
        }

        // Attach event listeners
        contract.current.on('IdentityCreated', handleIdentityCreated)
        contract.current.on('IdentityPurchased', handleIdentityPurchased)
        contract.current.on('ReputationUpdated', handleReputationUpdated)
        contract.current.on('AchievementUnlocked', handleAchievementUnlocked)

        console.log('🔄 Real-time NFT event sync enabled')

        return () => {
            if (contract.current) {
                contract.current.off('IdentityCreated', handleIdentityCreated)
                contract.current.off('IdentityPurchased', handleIdentityPurchased)
                contract.current.off('ReputationUpdated', handleReputationUpdated)
                contract.current.off('AchievementUnlocked', handleAchievementUnlocked)
                console.log('🔄 Real-time NFT event sync disabled')
            }
        }
    }, [address, callbacks])

    return {
        isListening: !!contract.current && !!address
    }
}