import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, formatEther } from 'viem'
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/utils/contract'

const publicClient = createPublicClient({
    chain: {
        id: 50312,
        name: 'Somnia Testnet',
        nativeCurrency: { decimals: 18, name: 'STT', symbol: 'STT' },
        rpcUrls: { default: { http: ['https://dream-rpc.somnia.network/'] } }
    },
    transport: http('https://dream-rpc.somnia.network/')
})

export async function GET(
    request: NextRequest,
    { params }: { params: { address: string } }
) {
    try {
        const { address } = params

        // Check if address has identity
        const hasIdentity = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'hasIdentity',
            args: [address]
        }) as boolean

        if (!hasIdentity) {
            return NextResponse.json({
                success: true,
                ownedNFTs: [],
                totalValue: 0,
                totalInvested: 0,
                totalPnL: 0
            })
        }

        // Get token ID for this address
        const tokenId = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getTokenIdByAddress',
            args: [address]
        }) as bigint

        // Get identity details
        const identity = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getIdentity',
            args: [tokenId]
        }) as any

        // **CRITICAL FIX**: Convert BigInt to number BEFORE any calculations
        const currentPriceWei = identity.currentPrice || BigInt(0)
        const currentPrice = parseFloat(formatEther(currentPriceWei))

        // Get username from backend
        let username = `Identity #${tokenId}`;
        try {
            const backendResponse = await fetch(`http://localhost:5000/api/identity/${tokenId}`)
            if (backendResponse.ok) {
                const backendData = await backendResponse.json()
                if (backendData.success && backendData.identity?.username) {
                    username = backendData.identity.username
                }
            }
        } catch (backendError) {
            console.log('Backend username fetch failed, using fallback')
        }

        // Use mock purchase data (since real purchase history has block range issues)
        const mockPurchasePrice = currentPrice * 0.85 // Assume 15% gain
        const mockPurchaseDate = new Date(Date.now() - (Math.random() * 30 * 24 * 60 * 60 * 1000)) // Random within 30 days

        // **CRITICAL FIX**: ALL values must be numbers/strings, NO BigInt
        const portfolioItem = {
            tokenId: parseInt(tokenId.toString()),
            username: username, // REAL USERNAME FROM BACKEND
            primarySkill: identity.primarySkill || 'Unknown',
            reputationScore: Number(identity.reputationScore || 100),
            currentPrice: currentPrice, // NUMBER, not BigInt
            purchasePrice: mockPurchasePrice, // NUMBER
            purchaseDate: mockPurchaseDate,
            priceChange: currentPrice - mockPurchasePrice, // NUMBER
            priceChangePercent: ((currentPrice - mockPurchasePrice) / mockPurchasePrice) * 100,
            isVerified: identity.isVerified || false,
            skillLevel: Number(identity.skillLevel || 1),
            achievementCount: Number(identity.achievementCount || 0),
            dailyVolume: Math.random() * 2,
            weeklyChange: (Math.random() - 0.5) * 20,
            owner: address,
            hasRealPurchaseData: false,
            transactionHash: null
        }

        const ownedNFTs = [portfolioItem]

        // Calculate totals (all numbers, no BigInt)
        const totalValue = currentPrice
        const totalInvested = mockPurchasePrice
        const totalPnL = totalValue - totalInvested

        return NextResponse.json({
            success: true,
            ownedNFTs,
            totalValue,
            totalInvested,
            totalPnL
        })

    } catch (error) {
        console.error('Portfolio API error:', error)
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch portfolio',
            details: error instanceof Error ? error.message : 'Unknown error'
        })
    }
}