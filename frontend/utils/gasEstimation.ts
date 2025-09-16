import { estimateGas, getGasPrice, readContract } from 'wagmi/actions'
import { parseGwei, formatGwei, formatEther } from 'viem'
import { config } from '@/utils/wagmi'
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/utils/contract'

// Define proper types for gas configuration
export interface LegacyGasConfig {
    gas: bigint
    gasPrice: bigint
}

export interface EIP1559GasConfig {
    gas: bigint
    maxFeePerGas: bigint
    maxPriorityFeePerGas: bigint
}

export type GasConfig = LegacyGasConfig | EIP1559GasConfig

// Type guard to check if config is EIP1559
export const isEIP1559Config = (config: GasConfig): config is EIP1559GasConfig => {
    return 'maxFeePerGas' in config && 'maxPriorityFeePerGas' in config
}

// Somnia-optimized gas config
export const getSomniaGasConfig = (): LegacyGasConfig => {
    return {
        gas: BigInt(900000), // Increased gas limit
        gasPrice: parseGwei('50'), // Much higher gas price (50 gwei)
    }
}

// Emergency high gas config for stubborn transactions
export const getEmergencyGasConfig = (): LegacyGasConfig => {
    return {
        gas: BigInt(1200000), // Very high gas limit
        gasPrice: parseGwei('100'), // Very high gas price (100 gwei)
    }
}

// Updated auto gas estimation with Somnia-specific settings
export const getAutoGasConfig = async (contractCall: any): Promise<LegacyGasConfig> => {
    try {
        console.log('🔍 Estimating gas for Somnia transaction...')

        // Use wagmi's estimateGas
        const estimatedGas = await estimateGas(config, contractCall)

        // Add 50% buffer for Somnia (more than usual 20%)
        const gasWithBuffer = BigInt(Math.floor(Number(estimatedGas) * 1.5))

        // Use much higher base gas price for Somnia
        const somniaBaseGasPrice = parseGwei('50') // Start with 50 gwei

        try {
            // Try to get current network gas price
            const currentGasPrice = await getGasPrice(config)
            const suggestedGasPrice = BigInt(Math.max(
                Number(currentGasPrice) * 1.5, // 50% above current
                Number(somniaBaseGasPrice) // At least 50 gwei
            ))

            console.log('✅ Somnia gas estimation:')
            console.log(`   Estimated gas: ${estimatedGas}`)
            console.log(`   Gas with buffer: ${gasWithBuffer}`)
            console.log(`   Suggested gas price: ${formatGwei(suggestedGasPrice)} gwei`)

            return {
                gas: gasWithBuffer,
                gasPrice: suggestedGasPrice,
            }
        } catch (priceError) {
            console.warn('Could not get network gas price, using high fallback')
            return {
                gas: gasWithBuffer,
                gasPrice: parseGwei('75'), // High fallback
            }
        }

    } catch (error) {
        console.warn('⚠️ Auto gas estimation failed, using Somnia defaults:', error)

        // Fallback to Somnia-optimized defaults
        return getSomniaGasConfig()
    }
}

// Enhanced auto gas estimation with EIP-1559 support
export const getEIP1559GasConfig = async (contractCall: any): Promise<EIP1559GasConfig> => {
    try {
        console.log('🔍 Using EIP-1559 gas estimation...')

        // Estimate gas limit
        const estimatedGas = await estimateGas(config, contractCall)
        const gasWithBuffer = BigInt(Math.floor(Number(estimatedGas) * 1.2))

        // For EIP-1559 networks, use maxFeePerGas and maxPriorityFeePerGas
        return {
            gas: gasWithBuffer,
            maxFeePerGas: parseGwei('25'), // Maximum willing to pay
            maxPriorityFeePerGas: parseGwei('2'), // Tip for miners
        }

    } catch (error) {
        console.warn('⚠️ EIP-1559 estimation failed, using fallback:', error)

        // Fallback EIP-1559 config
        return {
            gas: BigInt(500000),
            maxFeePerGas: parseGwei('25'),
            maxPriorityFeePerGas: parseGwei('2'),
        }
    }
}

// Debug function to check contract state before listing
export const debugContractState = async (tokenId: number, userAddress: string) => {
    try {
        console.group('🔍 Pre-listing Contract State Check')

        // Check token ownership
        const owner = await readContract(config, {
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'ownerOf',
            args: [BigInt(tokenId)]
        })
        console.log(`Owner: ${owner}`)
        console.log(`User: ${userAddress}`)
        console.log(`Ownership match: ${(owner as string).toLowerCase() === userAddress.toLowerCase()}`)

        // Check if already listed
        try {
            const isListed = await readContract(config, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'isListed',
                args: [BigInt(tokenId)]
            }) as boolean
            console.log(`Already listed: ${isListed}`)
        } catch (e) {
            console.log('Could not check isListed - function may not exist')
        }

        // Check token URI (confirms token exists)
        try {
            const tokenURI = await readContract(config, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'tokenURI',
                args: [BigInt(tokenId)]
            })
            console.log(`Token URI exists: ${!!tokenURI}`)
        } catch (e) {
            console.log('Could not get token URI - token may not exist')
        }

        // Check contract approval
        try {
            const isApproved = await readContract(config, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'isApprovedForAll',
                args: [userAddress as `0x${string}`, CONTRACT_ADDRESS]
            }) as boolean
            console.log(`Contract approved: ${isApproved}`)
        } catch (e) {
            console.log('Could not check approval')
        }

        console.groupEnd()
        return true
    } catch (error) {
        console.error('Contract state check failed:', error)
        console.groupEnd()
        return false
    }
}

// Utility to format gas config for logging
export const formatGasConfig = (gasConfig: GasConfig): Record<string, string> => {
    if (isEIP1559Config(gasConfig)) {
        return {
            gas: gasConfig.gas.toString(),
            maxFeePerGas: formatGwei(gasConfig.maxFeePerGas) + ' gwei',
            maxPriorityFeePerGas: formatGwei(gasConfig.maxPriorityFeePerGas) + ' gwei'
        }
    } else {
        return {
            gas: gasConfig.gas.toString(),
            gasPrice: formatGwei(gasConfig.gasPrice) + ' gwei'
        }
    }
}

// Simple gas config for basic transactions
export const getSimpleGasConfig = (): LegacyGasConfig => {
    return {
        gas: BigInt(300000),
        gasPrice: parseGwei('20')
    }
}

// High gas config for complex transactions
export const getHighGasConfig = (): LegacyGasConfig => {
    return {
        gas: BigInt(800000),
        gasPrice: parseGwei('50')
    }
}