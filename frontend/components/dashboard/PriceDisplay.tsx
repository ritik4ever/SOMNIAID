'use client'

import { useState } from 'react'
import { useReadContract } from 'wagmi'
import { formatEther } from 'viem'
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/utils/contract'

interface PriceDisplayProps {
    tokenId: number
}

export function PriceDisplay({ tokenId }: PriceDisplayProps) {
    const { data: price } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'identityPrices',
        args: [BigInt(tokenId)]
    })

    const { data: isListed } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'isListed',
        args: [BigInt(tokenId)]
    })

    if (!isListed || !price) {
        return <span className="text-gray-500">Not for sale</span>
    }

    return (
        <div className="bg-green-100 px-3 py-1 rounded-lg">
            <span className="text-green-800 font-semibold">
                {formatEther(BigInt(String(price || '0')))} STT
            </span>
        </div>
    )
}