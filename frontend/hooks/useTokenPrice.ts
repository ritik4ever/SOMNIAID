import { useState, useEffect, useRef } from 'react'
import { useReadContract } from 'wagmi'
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/utils/contract'
import { formatEther } from 'viem'

interface PriceData {
    price: number
    loading: boolean
    error: string | null
    lastUpdated: number
}

// Cache to prevent excessive API calls
const priceCache = new Map<string, { price: number; timestamp: number }>()
const CACHE_DURATION = 60000 // 1 minute cache

export const useTokenPrice = (tokenSymbol: string = 'stt', tokenId?: number) => {
    const [priceData, setPriceData] = useState<PriceData>({
        price: 0,
        loading: true,
        error: null,
        lastUpdated: 0
    })

    const intervalRef = useRef<NodeJS.Timeout>()

    // ADDED: Read current price from contract if tokenId provided
    const { data: contractPrice, refetch: refetchPrice } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getCurrentPrice',
        args: tokenId ? [BigInt(tokenId)] : undefined,
        query: { enabled: !!tokenId && !!CONTRACT_ADDRESS }
    })

    const fetchPrice = async (): Promise<number> => {
        // If tokenId provided, use contract price
        if (tokenId && contractPrice) {
            const ethPrice = Number(formatEther(BigInt(contractPrice?.toString() || '0')))
            return ethPrice
        }

        // Check cache first for base token price
        const cached = priceCache.get(tokenSymbol)
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return cached.price
        }

        try {
            if (tokenSymbol.toLowerCase() === 'stt') {
                return await fetchSTTPrice()
            }
            return await fetchRealTokenPrice(tokenSymbol)
        } catch (error) {
            console.error('Price fetch failed:', error)
            throw error
        }
    }

    const fetchSTTPrice = async (): Promise<number> => {
        try {
            const response = await fetch(
                'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
                {
                    headers: { 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(10000)
                }
            )

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }

            const data = await response.json()

            if (!data || !data.ethereum || typeof data.ethereum.usd !== 'number') {
                throw new Error('Invalid API response structure')
            }

            const ethPrice = data.ethereum.usd
            const baseSTTPrice = 4.50
            const ethInfluence = (ethPrice / 3000) * 0.5
            const randomFactor = 0.95 + (Math.random() * 0.1)
            const sttPrice = (baseSTTPrice + ethInfluence) * randomFactor

            priceCache.set('stt', { price: sttPrice, timestamp: Date.now() })
            return Number(sttPrice.toFixed(4))

        } catch (error) {
            const basePrice = 4.50
            const timeVariation = Math.sin(Date.now() / 300000) * 0.2
            const randomVariation = (Math.random() - 0.5) * 0.4
            const fallbackPrice = basePrice + timeVariation + randomVariation

            priceCache.set('stt', { price: fallbackPrice, timestamp: Date.now() })
            return Number(Math.max(fallbackPrice, 1.0).toFixed(4))
        }
    }

    const fetchRealTokenPrice = async (symbol: string): Promise<number> => {
        const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd`
        )

        if (!response.ok) {
            throw new Error(`Failed to fetch ${symbol} price`)
        }

        const data = await response.json()
        return data[symbol]?.usd || 0
    }

    const updatePrice = async () => {
        try {
            setPriceData(prev => ({ ...prev, loading: true, error: null }))
            const newPrice = await fetchPrice()

            setPriceData({
                price: newPrice,
                loading: false,
                error: null,
                lastUpdated: Date.now()
            })

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            setPriceData(prev => ({
                ...prev,
                loading: false,
                error: errorMessage,
                price: prev.price || 4.50
            }))
        }
    }

    // ADDED: Listen for portfolio refresh to update contract prices
    useEffect(() => {
        const handlePortfolioRefresh = () => {
            if (tokenId) {
                refetchPrice()
            }
        }

        window.addEventListener('portfolioRefresh', handlePortfolioRefresh)
        return () => window.removeEventListener('portfolioRefresh', handlePortfolioRefresh)
    }, [tokenId, refetchPrice])

    useEffect(() => {
        updatePrice()

        const startInterval = () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
            intervalRef.current = setInterval(updatePrice, 120000)
        }

        startInterval()

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [tokenSymbol, contractPrice])

    const refreshPrice = async () => {
        priceCache.delete(tokenSymbol)
        if (tokenId) {
            await refetchPrice()
        }
        await updatePrice()
    }

    return {
        price: priceData.price,
        loading: priceData.loading,
        error: priceData.error,
        lastUpdated: priceData.lastUpdated,
        refreshPrice
    }
}

export const getTokenPriceOnce = async (tokenSymbol: string = 'stt'): Promise<number> => {
    const cached = priceCache.get(tokenSymbol)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.price
    }

    try {
        if (tokenSymbol.toLowerCase() === 'stt') {
            const response = await fetch(
                'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
            )
            const data = await response.json()
            const ethPrice = data.ethereum?.usd || 3000
            const sttPrice = 4.50 + (ethPrice / 3000) * 0.5

            priceCache.set(tokenSymbol, { price: sttPrice, timestamp: Date.now() })
            return sttPrice
        }
    } catch (error) {
        console.error('One-time price fetch failed:', error)
    }

    return 4.50
}