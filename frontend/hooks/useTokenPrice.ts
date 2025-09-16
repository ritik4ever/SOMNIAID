import { useState, useEffect, useRef } from 'react'

interface PriceData {
    price: number
    loading: boolean
    error: string | null
    lastUpdated: number
}

// Cache to prevent excessive API calls
const priceCache = new Map<string, { price: number; timestamp: number }>()
const CACHE_DURATION = 60000 // 1 minute cache

export const useTokenPrice = (tokenSymbol: string = 'stt') => {
    const [priceData, setPriceData] = useState<PriceData>({
        price: 0,
        loading: true,
        error: null,
        lastUpdated: 0
    })

    const intervalRef = useRef<NodeJS.Timeout>()

    const fetchPrice = async (): Promise<number> => {
        // Check cache first
        const cached = priceCache.get(tokenSymbol)
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log('Using cached price:', cached.price)
            return cached.price
        }

        try {
            // For STT testnet, we need a mock price since it's not a real traded token
            if (tokenSymbol.toLowerCase() === 'stt') {
                return await fetchSTTPrice()
            }

            // For other tokens, use real API
            return await fetchRealTokenPrice(tokenSymbol)

        } catch (error) {
            console.error('Price fetch failed:', error)
            throw error
        }
    }

    const fetchSTTPrice = async (): Promise<number> => {
        try {
            // Option 1: Use ETH as base with more realistic calculation
            const response = await fetch(
                'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
                {
                    headers: {
                        'Accept': 'application/json',
                    },
                    signal: AbortSignal.timeout(10000) // 10 second timeout
                }
            )

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }

            const data = await response.json()

            // Validate response structure
            if (!data || !data.ethereum || typeof data.ethereum.usd !== 'number') {
                throw new Error('Invalid API response structure')
            }

            // More realistic STT price simulation
            // Base on ETH but add some randomness to simulate market movement
            const ethPrice = data.ethereum.usd
            const baseSTTPrice = 4.50 // Base price around $4.50
            const ethInfluence = (ethPrice / 3000) * 0.5 // ETH influence factor
            const randomFactor = 0.95 + (Math.random() * 0.1) // ±5% daily variation

            const sttPrice = (baseSTTPrice + ethInfluence) * randomFactor

            // Cache the result
            priceCache.set('stt', { price: sttPrice, timestamp: Date.now() })

            console.log('STT price calculated:', {
                ethPrice,
                baseSTTPrice,
                ethInfluence,
                randomFactor,
                finalPrice: sttPrice
            })

            return Number(sttPrice.toFixed(4))

        } catch (error) {
            // Enhanced fallback strategy
            console.warn('ETH-based price failed, using fallback calculation')

            // Fallback: Time-based price simulation
            const basePrice = 4.50
            const timeVariation = Math.sin(Date.now() / 300000) * 0.2 // 5-minute cycle
            const randomVariation = (Math.random() - 0.5) * 0.4 // ±$0.20

            const fallbackPrice = basePrice + timeVariation + randomVariation

            // Cache fallback too
            priceCache.set('stt', { price: fallbackPrice, timestamp: Date.now() })

            return Number(Math.max(fallbackPrice, 1.0).toFixed(4)) // Minimum $1
        }
    }

    const fetchRealTokenPrice = async (symbol: string): Promise<number> => {
        // For real tokens (if you add support later)
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
                // Keep last known price on error
                price: prev.price || 4.50
            }))
        }
    }

    useEffect(() => {
        // Initial fetch
        updatePrice()

        // Set up interval with exponential backoff on errors
        const startInterval = () => {
            // Clear existing interval
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }

            // Update every 2 minutes instead of 30 seconds to avoid rate limits
            intervalRef.current = setInterval(updatePrice, 120000)
        }

        startInterval()

        // Cleanup on unmount
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [tokenSymbol])

    // Manual refresh function
    const refreshPrice = async () => {
        // Clear cache for this token
        priceCache.delete(tokenSymbol)
        await updatePrice()
    }

    return {
        price: priceData.price,
        loading: priceData.loading,
        error: priceData.error,
        lastUpdated: priceData.lastUpdated,
        refreshPrice // Expose manual refresh
    }
}

// Export utility function to get price without hook
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