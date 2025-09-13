'use client'

import { motion } from 'framer-motion'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import { Zap, Shield, Users, Trophy } from 'lucide-react'

export function Hero() {
    const { isConnected } = useAccount()

    return (
        <section className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
            {/* Background Elements */}
            <div className="absolute inset-0">
                <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500 rounded-full opacity-20 blur-3xl animate-pulse-slow"></div>
                <div className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-500 rounded-full opacity-20 blur-3xl animate-pulse-slow delay-1000"></div>
            </div>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
                <div className="text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="mb-8"
                    >
                        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
                            Your Identity,
                            <span className="block gradient-text">Evolving in Real-Time</span>
                        </h1>
                        <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                            Dynamic NFTs that grow with your reputation on Somnia Network.
                            Built for speed, designed for the future.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
                    >
                        {isConnected ? (
                            <Link
                                href="/dashboard"
                                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
                            >
                                Go to Dashboard
                            </Link>
                        ) : (
                            <ConnectButton />
                        )}

                        <Link
                            href="/explore"
                            className="border-2 border-white/30 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white/10 transition-all duration-300"
                        >
                            Explore Identities
                        </Link>
                    </motion.div>

                    {/* Feature Icons */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 0.4 }}
                        className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
                    >
                        {[
                            { icon: Zap, title: "Sub-Second Updates", desc: "Real-time reputation changes" },
                            { icon: Shield, title: "Verified Skills", desc: "Blockchain-proven achievements" },
                            { icon: Users, title: "Cross-Platform", desc: "Works across all dApps" },
                            { icon: Trophy, title: "Dynamic Rewards", desc: "Evolving NFT metadata" }
                        ].map((feature, index) => (
                            <div key={index} className="glass-morphism rounded-2xl p-6 hover:scale-105 transition-transform duration-300">
                                <feature.icon className="w-8 h-8 text-purple-300 mx-auto mb-3" />
                                <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
                                <p className="text-gray-300 text-sm">{feature.desc}</p>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </div>
        </section>
    )
}