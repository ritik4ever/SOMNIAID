'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectKitButton } from 'connectkit'
import { useAccount } from 'wagmi'
import { Zap, Menu, X } from 'lucide-react'

export function Navbar() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const pathname = usePathname()
    const { isConnected, address } = useAccount()

    const navigation = [
        { name: 'Home', href: '/', current: pathname === '/' },
        { name: 'Explore', href: '/explore', current: pathname === '/explore' },
        { name: 'Leaderboard', href: '/leaderboard', current: pathname === '/leaderboard' },
        {
            name: 'Dashboard',
            href: '/dashboard',
            current: pathname === '/dashboard',
            requiresWallet: true
        },
    ]

    useEffect(() => {
        setIsMobileMenuOpen(false)
    }, [pathname])

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
                            <Zap className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                            SomniaID
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center space-x-8">
                        {navigation.map((item) => {
                            // Hide wallet-required items if not connected
                            if (item.requiresWallet && !isConnected) {
                                return null
                            }

                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${item.current
                                        ? 'bg-purple-100 text-purple-700'
                                        : 'text-gray-700 hover:text-purple-600 hover:bg-purple-50'
                                        }`}
                                >
                                    {item.name}
                                </Link>
                            )
                        })}
                    </div>

                    {/* Wallet Connect & Mobile Menu */}
                    <div className="flex items-center space-x-4">
                        {/* Wallet Info */}
                        {isConnected && address && (
                            <div className="hidden sm:flex items-center space-x-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span>{address.slice(0, 6)}...{address.slice(-4)}</span>
                            </div>
                        )}

                        <ConnectKitButton />

                        {/* Mobile menu button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100"
                        >
                            {isMobileMenuOpen ? (
                                <X className="w-5 h-5" />
                            ) : (
                                <Menu className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Navigation */}
            {isMobileMenuOpen && (
                <div className="md:hidden bg-white border-t border-gray-200">
                    <div className="px-4 py-2 space-y-1">
                        {navigation.map((item) => {
                            // Hide wallet-required items if not connected
                            if (item.requiresWallet && !isConnected) {
                                return null
                            }

                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${item.current
                                        ? 'bg-purple-100 text-purple-700'
                                        : 'text-gray-700 hover:text-purple-600 hover:bg-purple-50'
                                        }`}
                                >
                                    {item.name}
                                </Link>
                            )
                        })}
                    </div>
                </div>
            )}
        </nav>
    )
}