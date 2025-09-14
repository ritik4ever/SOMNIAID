'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectKitButton } from 'connectkit'

import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Zap, User, Search, Trophy } from 'lucide-react'

export function Navbar() {
    const [isOpen, setIsOpen] = useState(false)
    const pathname = usePathname()
    const { isConnected } = useAccount()

    const navItems = [
        { href: '/', label: 'Home', icon: Zap },
        { href: '/explore', label: 'Explore', icon: Search },
        { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
        ...(isConnected ? [{ href: '/dashboard', label: 'Dashboard', icon: User }] : [])
    ]

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center">
                            <Zap className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-2xl font-bold gradient-text">SomniaID</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center space-x-8">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${pathname === item.href
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
                                    }`}
                            >
                                <item.icon className="w-4 h-4" />
                                <span className="font-medium">{item.label}</span>
                            </Link>
                        ))}
                    </div>

                    {/* Connect Button */}
                    <div className="hidden md:block">
                        <ConnectKitButton />
                    </div>

                    {/* Mobile menu button */}
                    <div className="md:hidden">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="p-2 rounded-lg text-gray-600 hover:text-purple-600 hover:bg-purple-50"
                        >
                            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Navigation */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden bg-white border-t border-gray-200"
                    >
                        <div className="px-4 py-4 space-y-2">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsOpen(false)}
                                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${pathname === item.href
                                        ? 'bg-purple-100 text-purple-700'
                                        : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
                                        }`}
                                >
                                    <item.icon className="w-5 h-5" />
                                    <span className="font-medium">{item.label}</span>
                                </Link>
                            ))}

                            <div className="pt-4 border-t border-gray-200">
                                <ConnectKitButton />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    )
}