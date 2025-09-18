
import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http } from 'viem'
import { defineChain } from 'viem'
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/utils/contract'

// Define Somnia testnet
const somniaTestnet = defineChain({
    id: 50311,
    name: 'Somnia Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'STT',
        symbol: 'STT',
    },
    rpcUrls: {
        default: {
            http: ['https://dream-rpc.somnia.network/'],
        },
    },
    blockExplorers: {
        default: {
            name: 'Somnia Explorer',
            url: 'https://shannon-explorer.somnia.network',
        },
    },
})

const publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: http('https://dream-rpc.somnia.network/')
})

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { functionName, args = [] } = body

        if (!functionName) {
            return NextResponse.json({
                success: false,
                error: 'Function name is required'
            }, { status: 400 })
        }

        console.log('Reading contract function:', functionName, 'with args:', args)

        const data = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName,
            args
        })

        return NextResponse.json({
            success: true,
            data
        })
    } catch (error) {
        console.error('Contract read failed:', error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Contract read failed'
        }, { status: 500 })
    }
}
