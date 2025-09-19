import { useEffect, useRef } from 'react'
import { useAccount, useWatchContractEvent } from 'wagmi'
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

    // Watch for IdentityCreated events
    useWatchContractEvent({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        eventName: 'IdentityCreated',
        onLogs(logs) {
            logs.forEach((log: any) => {
                const { tokenId, owner, username } = log.args
                console.log('Identity created event:', { tokenId, owner, username })

                if (owner?.toLowerCase() === address?.toLowerCase()) {
                    toast.success(`Identity "${username}" created successfully!`)
                    setTimeout(() => {
                        callbacks.onIdentityCreated?.()
                        // Trigger portfolio refresh
                        window.dispatchEvent(new CustomEvent('portfolioRefresh'))
                    }, 1000)
                }
            })
        }
    })

    // Watch for IdentityPurchased events - CRITICAL FOR PORTFOLIO SYNC
    useWatchContractEvent({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        eventName: 'IdentityPurchased',
        onLogs(logs) {
            logs.forEach((log: any) => {
                const { tokenId, buyer, seller, price } = log.args
                const priceInEth = Number(price) / 1e18

                console.log('Identity purchased event:', { tokenId, buyer, seller, price: priceInEth })

                // Notify seller - payment automatically transferred
                if (seller?.toLowerCase() === address?.toLowerCase()) {
                    toast.success(`💰 Your NFT sold for ${priceInEth.toFixed(4)} ETH! Payment received in wallet.`, {
                        duration: 8000,
                        icon: '💰'
                    })
                }

                // Notify buyer - NFT now in their portfolio
                if (buyer?.toLowerCase() === address?.toLowerCase()) {
                    toast.success(`🎉 NFT purchased successfully! Now in your portfolio.`, {
                        duration: 5000
                    })
                }

                // CRITICAL: Refresh portfolio and marketplace for both parties
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('portfolioRefresh'))
                    window.dispatchEvent(new CustomEvent('marketplaceRefresh'))
                    callbacks.refreshIdentity?.()
                    callbacks.onIdentityPurchased?.(Number(tokenId), buyer, seller, price)
                }, 2000)
            })
        }
    })

    // Watch for AchievementUnlocked events - AFFECTS PRICE
    useWatchContractEvent({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        eventName: 'AchievementUnlocked',
        onLogs(logs) {
            logs.forEach((log: any) => {
                const { tokenId, title, points, priceImpact } = log.args
                console.log('Achievement unlocked event:', { tokenId, title, points, priceImpact })

                toast.success(`🏆 Achievement unlocked: ${title} (+${points} points, +${priceImpact}bp price impact!)`, {
                    duration: 4000
                })

                setTimeout(() => {
                    callbacks.onAchievementUnlocked?.()
                    callbacks.refreshIdentity?.()
                    window.dispatchEvent(new CustomEvent('portfolioRefresh'))
                }, 1000)
            })
        }
    })

    // Watch for PriceUpdated events - REAL-TIME PRICE CHANGES
    useWatchContractEvent({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        eventName: 'PriceUpdated',
        onLogs(logs) {
            logs.forEach((log: any) => {
                const { tokenId, oldPrice, newPrice, reason } = log.args

                const oldPriceEth = Number(oldPrice) / 1e18
                const newPriceEth = Number(newPrice) / 1e18
                const change = ((newPriceEth - oldPriceEth) / oldPriceEth * 100).toFixed(1)

                console.log('Price updated event:', { tokenId, oldPriceEth, newPriceEth, change, reason })

                if (newPrice > oldPrice) {
                    toast.success(`📈 NFT #${tokenId} price increased to ${newPriceEth.toFixed(4)} ETH (+${change}%)`, {
                        duration: 4000
                    })
                } else if (newPrice < oldPrice) {
                    toast.error(`📉 NFT #${tokenId} price decreased to ${newPriceEth.toFixed(4)} ETH (${change}%)`, {
                        duration: 4000
                    })
                }

                setTimeout(() => {
                    callbacks.refreshIdentity?.()
                    window.dispatchEvent(new CustomEvent('portfolioRefresh'))
                    window.dispatchEvent(new CustomEvent('leaderboardRefresh'))
                }, 1000)
            })
        }
    })

    // Watch for Transfer events - Standard ERC721 event
    useWatchContractEvent({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        eventName: 'Transfer',
        onLogs(logs) {
            logs.forEach((log: any) => {
                const { from, to, tokenId } = log.args

                // Check if it's a purchase (not mint)
                if (from !== '0x0000000000000000000000000000000000000000') {
                    console.log('NFT transferred:', { from, to, tokenId })

                    if (to?.toLowerCase() === address?.toLowerCase()) {
                        toast.success('NFT purchased successfully! Now in your portfolio.')
                        window.dispatchEvent(new CustomEvent('portfolioRefresh'))
                    }
                }
            })
        }
    })

    // Watch for GoalFailed events - PRICE PENALTIES
    useWatchContractEvent({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        eventName: 'GoalFailed',
        onLogs(logs) {
            logs.forEach((log: any) => {
                const { tokenId, goalIndex, pricePenalty } = log.args
                console.log('Goal failed event:', { tokenId, goalIndex, pricePenalty })

                toast.error(`❌ Goal deadline missed! NFT #${tokenId} gets -${pricePenalty} basis points price penalty.`, {
                    duration: 5000
                })

                setTimeout(() => {
                    callbacks.refreshIdentity?.()
                    window.dispatchEvent(new CustomEvent('portfolioRefresh'))
                }, 1000)
            })
        }
    })

    // Watch for ReputationUpdated events
    useWatchContractEvent({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        eventName: 'ReputationUpdated',
        onLogs(logs) {
            logs.forEach((log: any) => {
                const { tokenId, newScore } = log.args
                console.log('Reputation updated event:', { tokenId, newScore })

                setTimeout(() => {
                    callbacks.onReputationUpdated?.()
                    callbacks.refreshIdentity?.()
                }, 1000)
            })
        }
    })

    // Watch for IdentityListed events - NEW EVENT LISTENER
    useWatchContractEvent({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        eventName: 'IdentityListed',
        onLogs(logs) {
            logs.forEach((log: any) => {
                const { tokenId, price } = log.args

                if (Number(price) === 0) {
                    // This is an unlisting event (price set to 0)
                    console.log('❌ IdentityUnlisted blockchain event:', { tokenId: Number(tokenId) })
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('marketplaceRefresh'))
                    }, 2000)
                } else {
                    // This is a listing event
                    console.log('🏷️ IdentityListed blockchain event:', {
                        tokenId: Number(tokenId),
                        price: Number(price) / 1e18
                    })
                    // Emit refresh events with delay
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('marketplaceRefresh'))
                        window.dispatchEvent(new CustomEvent('identityListed'))
                    }, 2000) // 2 second delay for blockchain finality
                }
            })
        }
    })

    // Log sync status
    useEffect(() => {
        if (address && CONTRACT_ADDRESS) {
            console.log('🔄 Real-time NFT event sync enabled for:', address)
        }

        return () => {
            console.log('🔄 Real-time NFT event sync disabled')
        }
    }, [address])

    return {
        isListening: !!address && !!CONTRACT_ADDRESS
    }
}