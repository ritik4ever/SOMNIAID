'use client'

import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { ConnectKitProvider } from 'connectkit'
import { config } from '@/utils/wagmi'

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ErrorBoundary>
            <WagmiProvider config={config}>
                <QueryClientProvider client={queryClient}>
                    <ConnectKitProvider theme="auto">
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
                                    style: { background: '#10B981' },
                                },
                                error: {
                                    style: { background: '#EF4444' },
                                },
                            }}
                        />
                    </ConnectKitProvider>
                </QueryClientProvider>
            </WagmiProvider>
        </ErrorBoundary>
    )
}
