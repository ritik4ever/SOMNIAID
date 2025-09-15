'use client'

import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectKitProvider } from 'connectkit'
import { config } from '@/utils/wagmi'
import { useState, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'

// FIXED: Create QueryClient only once globally
let queryClientInstance: QueryClient | null = null

const getQueryClient = () => {
    if (!queryClientInstance) {
        queryClientInstance = new QueryClient({
            defaultOptions: {
                queries: {
                    staleTime: 60 * 1000,
                    retry: 1,
                },
            },
        })
    }
    return queryClientInstance
}

interface ProvidersProps {
    children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
    const [mounted, setMounted] = useState(false)
    const queryClient = getQueryClient()

    useEffect(() => {
        setMounted(true)
    }, [])

    // Prevent hydration mismatch
    if (!mounted) {
        return null
    }

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <ConnectKitProvider
                    theme="auto"
                    mode="auto"
                    customTheme={{
                        '--ck-connectbutton-font-size': '16px',
                        '--ck-connectbutton-border-radius': '8px',
                    }}
                >
                    {children}
                    <Toaster
                        position="top-right"
                        toastOptions={{
                            duration: 4000,
                            style: {
                                background: '#363636',
                                color: '#fff',
                            },
                        }}
                    />
                </ConnectKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    )
}

// Use this in your layout.tsx or _app.tsx
export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body>
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    )
}