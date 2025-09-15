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

// Clear WalletConnect data to prevent conflicts
if (typeof window !== 'undefined') {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
        if (key.startsWith('wc@2') || key.startsWith('walletconnect')) {
            localStorage.removeItem(key);
        }
    });
}

// FIXED: Dynamic URLs for production/localhost
const getAppUrl = () => {
    if (typeof window !== 'undefined') {
        return window.location.origin
    }
    // Fallback based on environment
    return process.env.NODE_ENV === 'production'
        ? 'https://somniaid.vercel.app'
        : 'http://localhost:3000'
}

// Singleton pattern to prevent multiple configs
let configInstance: any = null

export const config = (() => {
    if (configInstance) {
        return configInstance
    }

    const baseUrl = getAppUrl()

    configInstance = createConfig(
        getDefaultConfig({
            appName: 'SomniaID',
            appDescription: 'Dynamic Reputation NFTs on Somnia Network',
            appUrl: baseUrl, // FIXED: Use actual deployment URL
            appIcon: `${baseUrl}/favicon.ico`, // FIXED: Use actual favicon
            walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
            chains: [somniaTestnet, mainnet, sepolia],
            transports: {
                [somniaTestnet.id]: http(),
                [mainnet.id]: http(),
                [sepolia.id]: http(),
            },
            ssr: true, // Important for Vercel deployment
        })
    )

    return configInstance
})()

declare module 'wagmi' {
    interface Register {
        config: typeof config
    }
}