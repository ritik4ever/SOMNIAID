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

// Clean up WalletConnect storage only once
if (typeof window !== 'undefined' && !window.__wcCleared) {
    try {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('wc@2') || key.includes('walletconnect')) {
                localStorage.removeItem(key);
            }
        });
        window.__wcCleared = true;
    } catch (error) {
        console.warn('Could not clear WalletConnect storage:', error);
    }
}

export const config = createConfig(
    getDefaultConfig({
        appName: 'SomniaID',
        appDescription: 'Dynamic Reputation NFTs on Somnia Network',
        appUrl: process.env.NODE_ENV === 'production'
            ? 'https://somniaid.vercel.app'
            : 'http://localhost:3000',
        appIcon: '/favicon.ico',
        walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
        chains: [somniaTestnet, mainnet, sepolia],
        transports: {
            [somniaTestnet.id]: http(),
            [mainnet.id]: http(),
            [sepolia.id]: http(),
        },
        ssr: true,
    })
)

declare module 'wagmi' {
    interface Register {
        config: typeof config
    }
}

// Add to window type
declare global {
    interface Window {
        __wcCleared?: boolean;
    }
}