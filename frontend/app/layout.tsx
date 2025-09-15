import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import Navbar from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'


const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'SomniaID - Real-Time Reputation NFTs',
    description: 'Dynamic identity NFTs that evolve with your on-chain reputation',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <Providers>
                    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
                        <Navbar />
                        <main className="pt-16">
                            {children}
                        </main>
                        <Footer />
                    </div>
                </Providers>
            </body>
        </html>
    )
}