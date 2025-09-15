'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { ConnectKitButton } from 'connectkit'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import { Menu, X, Zap, ShoppingCart, Wallet, TrendingUp } from 'lucide-react'

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false)
    const pathname = usePathname()
    const { isConnected } = useAccount()

    const navigation = [
        { name: 'Home', href: '/', icon: null },
        { name: 'Explore', href: '/explore', icon: null },
        { name: 'Marketplace', href: '/marketplace', icon: ShoppingCart },
        { name: 'Leaderboard', href: '/leaderboard', icon: TrendingUp },
        { name: 'Dashboard', href: '/dashboard', icon: null, requiresConnection: true },
        { name: 'Portfolio', href: '/portfolio', icon: Wallet, requiresConnection: true }
    ]

    const isActive = (href: string) => {
        if (href === '/') {
            return pathname === '/'
        }
        return pathname?.startsWith(href) || false
    }

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                            <Zap className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            SomniaID
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center space-x-1">
                        {navigation.map((item) => {
                            // Skip items that require connection if not connected
                            if (item.requiresConnection && !isConnected) {
                                return null
                            }

                            const Icon = item.icon

                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`flex items-center space-x-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${isActive(item.href)
                                        ? 'bg-blue-50 text-blue-700 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                >
                                    {Icon && <Icon className="w-4 h-4" />}
                                    <span>{item.name}</span>
                                </Link>
                            )
                        })}
                    </div>

                    {/* Wallet Connection & Mobile Menu */}
                    <div className="flex items-center space-x-4">
                        {/* Connect Wallet Button */}
                        <div className="hidden sm:block">
                            <ConnectKitButton />
                        </div>

                        {/* Mobile menu button */}
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="md:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                        >
                            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Navigation */}
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="md:hidden bg-white border-t border-gray-100"
                >
                    <div className="px-4 py-4 space-y-2">
                        {navigation.map((item) => {
                            // Skip items that require connection if not connected
                            if (item.requiresConnection && !isConnected) {
                                return null
                            }

                            const Icon = item.icon

                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => setIsOpen(false)}
                                    className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${isActive(item.href)
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                >
                                    {Icon && <Icon className="w-4 h-4" />}
                                    <span>{item.name}</span>
                                </Link>
                            )
                        })}

                        {/* Mobile Connect Button */}
                        <div className="pt-4 border-t border-gray-100">
                            <ConnectKitButton />
                        </div>
                    </div>
                </motion.div>
            )}
        </nav>
    )
}