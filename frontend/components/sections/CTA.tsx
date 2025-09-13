'use client'

import { motion } from 'framer-motion'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import { ArrowRight, Sparkles, Zap } from 'lucide-react'

export function CTA() {
    const { isConnected } = useAccount()

    return (
        <section className="py-24 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0">
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500 rounded-full opacity-20 blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-500 rounded-full opacity-20 blur-3xl animate-pulse delay-1000" />
            </div>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-6 py-3 mb-8">
                        <Sparkles className="w-5 h-5 text-yellow-400" />
                        <span className="text-white font-medium">Ready to build your reputation?</span>
                    </div>

                    <h2 className="text-5xl md:text-7xl font-bold text-white mb-6">
                        Your Journey
                        <span className="block gradient-text">Starts Now</span>
                    </h2>

                    <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-12">
                        Create your dynamic identity NFT and watch it evolve with every achievement.
                        Built on Somnia for the speed of tomorrow.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
                        {isConnected ? (
                            <Link
                                href="/dashboard"
                                className="group bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-10 py-5 rounded-2xl font-bold text-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center space-x-3"
                            >
                                <span>Create Your Identity</span>
                                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        ) : (
                            <div className="scale-125">
                                <ConnectButton />
                            </div>
                        )}

                        <Link
                            href="/explore"
                            className="border-2 border-white/30 text-white px-10 py-5 rounded-2xl font-bold text-xl hover:bg-white/10 transition-all duration-300 flex items-center space-x-3"
                        >
                            <span>Explore First</span>
                            <Zap className="w-6 h-6" />
                        </Link>
                    </div>

                    {/* Feature Highlights */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 0.3 }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto"
                    >
                        {[
                            {
                                title: "Instant Updates",
                                description: "Reputation changes in sub-seconds",
                                icon: "⚡"
                            },
                            {
                                title: "Verified Skills",
                                description: "Blockchain-proven achievements",
                                icon: "🏆"
                            },
                            {
                                title: "Cross-Platform",
                                description: "Works across all Somnia dApps",
                                icon: "🌐"
                            }
                        ].map((feature, index) => (
                            <div key={index} className="text-center">
                                <div className="text-4xl mb-4">{feature.icon}</div>
                                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                                <p className="text-gray-300">{feature.description}</p>
                            </div>
                        ))}
                    </motion.div>
                </motion.div>
            </div>
        </section>
    )
}