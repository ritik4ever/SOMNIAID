import { useState, useEffect } from 'react'

export const useTokenPrice = (tokenSymbol: string = 'stt') => {
    const [price, setPrice] = useState<number>(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchPrice = async () => {
            try {
                setLoading(true)
                setError(null)

                // For STT testnet, we'll use ETH as proxy since STT has no market data
                const response = await fetch(
                    'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
                )

                if (!response.ok) {
                    throw new Error('Failed to fetch price')
                }

                const data = await response.json()

                if (data.ethereum) {
                    // STT simulated as 0.1% of ETH price for testnet
                    const sttPrice = data.ethereum.usd * 0.001
                    setPrice(sttPrice)
                } else {
                    throw new Error('Price data not found')
                }
            } catch (err) {
                console.error('Price fetch error:', err)
                setError(err instanceof Error ? err.message : 'Unknown error')
                // Fallback price for testnet
                setPrice(1.5)
            } finally {
                setLoading(false)
            }
        }

        fetchPrice()
        // Refresh price every 30 seconds
        const interval = setInterval(fetchPrice, 30000)
        return () => clearInterval(interval)
    }, [tokenSymbol])

    return { price, loading, error }
}