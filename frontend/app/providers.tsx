'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

// Somnia Network configuration
const somniaTestnet = {
    id: 50312,
    name: 'Somnia Shannon Testnet',
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
            url: 'https://shannon-explorer.somnia.network/'
        },
    },
    testnet: true,
} as const;

const config = getDefaultConfig({
    appName: 'SomniaID',
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
    chains: [somniaTestnet],
    ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ErrorBoundary>
            <WagmiProvider config={config}>
                <QueryClientProvider client={queryClient}>
                    <RainbowKitProvider>
                        {children}
                        <Toaster
                            position="top-right"
                            toastOptions={{
                                duration: 4000,
                                style: {
                                    background: '#363636',
                                    color: '#fff',
                                    borderRadius: '12px',
                                },
                                success: {
                                    style: {
                                        background: '#10B981',
                                    },
                                },
                                error: {
                                    style: {
                                        background: '#EF4444',
                                    },
                                },
                            }}
                        />
                    </RainbowKitProvider>
                </QueryClientProvider>
            </WagmiProvider>
        </ErrorBoundary>
    );
}