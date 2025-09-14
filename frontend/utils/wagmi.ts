'use client'

import { http, createConfig } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { getDefaultConfig } from 'connectkit'

// Define Somnia testnet
export const somniaTestnet = {
    id: 50312,
    name: 'Somnia Testnet',
    network: 'somnia-testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'STT',
        symbol: 'STT',
    },
    rpcUrls: {
        public: { http: ['https://dream-rpc.somnia.network/'] },
        default: { http: ['https://dream-rpc.somnia.network/'] },
    },
    blockExplorers: {
        default: { name: 'Somnia Explorer', url: 'https://shannon-explorer.somnia.network' },
    },
    testnet: true,
} as const

// ✅ Must call createConfig so it's a Config object
export const config = createConfig(
    getDefaultConfig({
        appName: 'SomniaID',
        appDescription: 'Dynamic Reputation NFTs on Somnia Network',
        appUrl: 'https://somniaID.com',
        appIcon: 'https://somniaID.com/icon.png',
        walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
        chains: [somniaTestnet, mainnet, sepolia],
        transports: {
            [somniaTestnet.id]: http(),
            [mainnet.id]: http(),
            [sepolia.id]: http(),
        },
    })
)

declare module 'wagmi' {
    interface Register {
        config: typeof config
    }
}
