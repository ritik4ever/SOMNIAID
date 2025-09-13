'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Zap, Shield, Globe, TrendingUp, Users, Star, Trophy, Activity, CheckCircle } from 'lucide-react'

const features = [
    {
        icon: Zap,
        title: 'Sub-Second Updates',
        description: 'Real-time reputation changes powered by Somnia Network',
        color: 'text-blue-600 bg-blue-100'
    },
    {
        icon: Shield,
        title: 'Verified Skills',
        description: 'Blockchain-proven achievements and credentials',
        color: 'text-green-600 bg-green-100'
    },
    {
        icon: Globe,
        title: 'Cross-Platform',
        description: 'Works across all dApps in the Somnia ecosystem',
        color: 'text-purple-600 bg-purple-100'
    },
    {
        icon: TrendingUp,
        title: 'Dynamic Rewards',
        description: 'NFT metadata that evolves with your growth',
        color: 'text-orange-600 bg-orange-100'
    }
]

const stats = [
    { label: 'Active Identities', value: '10K+', icon: Users },
    { label: 'Reputation Points', value: '2M+', icon: Star },
    { label: 'Achievements', value: '50K+', icon: Trophy },
    { label: 'Live Updates/sec', value: '1M+', icon: Activity }
]

export default function HomePage() {
    return (
        <div className="min-h-screen">
            {/* Hero Section */}
            <section className="pt-20 pb-16 bg-gradient-to-br from-blue-50 via-white to-purple-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-8"
                        >
                            <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-6">
                                ⚡ Ready to build your reputation?
                            </div>

                            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6">
                                Your Identity,
                                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent block">
                                    Evolving in Real-Time
                                </span>
                            </h1>

                            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-4xl mx-auto">
                                Create your dynamic identity NFT and watch it evolve with every achievement.
                                Built on Somnia for the speed of tomorrow.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Link
                                    href="/dashboard"
                                    className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
                                >
                                    Create Your Identity
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </Link>

                                <Link
                                    href="/explore"
                                    className="inline-flex items-center px-8 py-4 bg-white text-gray-700 rounded-xl font-semibold text-lg border-2 border-gray-200 hover:border-blue-300 hover:text-blue-600 transition-all duration-300"
                                >
                                    Explore First ⚡
                                </Link>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-16 bg-white border-y border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                        {stats.map((stat, index) => (
                            <motion.div
                                key={stat.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="text-center"
                            >
                                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
                                    <stat.icon className="w-6 h-6 text-blue-600" />
                                </div>
                                <div className="text-3xl font-bold text-gray-900 mb-2">{stat.value}</div>
                                <div className="text-gray-600">{stat.label}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-gray-900 mb-4">
                            Built for the Future of Identity
                        </h2>
                        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                            Experience the next generation of digital identity with real-time updates and cross-platform compatibility
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {features.map((feature, index) => (
                            <motion.div
                                key={feature.title}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.2 }}
                                className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow"
                            >
                                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg mb-6 ${feature.color}`}>
                                    <feature.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-12 text-white"
                    >
                        <h2 className="text-4xl font-bold mb-6">
                            Ready to Start Your Journey?
                        </h2>
                        <p className="text-xl mb-8 text-blue-100">
                            Join thousands of users building their reputation on Somnia Network
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link
                                href="/dashboard"  // This should now work
                                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
                            >
                                Create Your Identity
                                <ArrowRight className="w-5 h-5 ml-2" />
                            </Link>
                            <Link
                                href="/leaderboard"
                                className="inline-flex items-center px-8 py-4 bg-blue-500 text-white rounded-xl font-semibold text-lg hover:bg-blue-400 transition-colors"
                            >
                                View Leaderboard
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>
        </div>
    )
}