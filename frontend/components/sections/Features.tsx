'use client'

import { motion } from 'framer-motion'
import {
    Zap,
    Shield,
    Users,
    Trophy,
    TrendingUp,
    Star,
    Gamepad2,
    Globe
} from 'lucide-react'

const features = [
    {
        icon: Zap,
        title: "Lightning Fast Updates",
        description: "Reputation changes in real-time thanks to Somnia's 1M+ TPS capability",
        color: "from-yellow-400 to-orange-500"
    },
    {
        icon: Shield,
        title: "Verified Achievements",
        description: "Blockchain-verified skills and accomplishments that can't be faked",
        color: "from-green-400 to-emerald-500"
    },
    {
        icon: Users,
        title: "Cross-Platform Identity",
        description: "One identity that works across all Somnia dApps and platforms",
        color: "from-blue-400 to-indigo-500"
    },
    {
        icon: Trophy,
        title: "Dynamic Rewards",
        description: "NFT metadata and visuals that evolve with your achievements",
        color: "from-purple-400 to-pink-500"
    },
    {
        icon: TrendingUp,
        title: "Reputation Analytics",
        description: "Track your reputation growth with detailed analytics and insights",
        color: "from-red-400 to-rose-500"
    },
    {
        icon: Star,
        title: "Skill Validation",
        description: "Prove your expertise through on-chain activity and peer validation",
        color: "from-cyan-400 to-blue-500"
    },
    {
        icon: Gamepad2,
        title: "Gamified Experience",
        description: "Level up your identity through achievements and skill progression",
        color: "from-violet-400 to-purple-500"
    },
    {
        icon: Globe,
        title: "Global Recognition",
        description: "Your reputation is recognized across the entire Somnia ecosystem",
        color: "from-indigo-400 to-blue-500"
    }
]

export function Features() {
    return (
        <section className="py-24 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-4xl md:text-5xl font-bold text-gray-900 mb-4"
                    >
                        Built for the Future of Web3
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-xl text-gray-600 max-w-3xl mx-auto"
                    >
                        SomniaID leverages cutting-edge blockchain technology to create
                        the most advanced identity system in Web3
                    </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {features.map((feature, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: index * 0.1 }}
                            className="group"
                        >
                            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${feature.color} p-4 mb-6 group-hover:scale-110 transition-transform duration-300`}>
                                    <feature.icon className="w-8 h-8 text-white" />
                                </div>

                                <h3 className="text-xl font-bold text-gray-900 mb-3">
                                    {feature.title}
                                </h3>

                                <p className="text-gray-600 leading-relaxed">
                                    {feature.description}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Technical Stats */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="mt-20 bg-gradient-to-r from-indigo-900 to-purple-900 rounded-3xl p-8 md:p-12"
                >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                        <div>
                            <div className="text-4xl md:text-5xl font-bold text-white mb-2">1M+</div>
                            <div className="text-indigo-200">Transactions Per Second</div>
                        </div>
                        <div>
                            <div className="text-4xl md:text-5xl font-bold text-white mb-2">&lt;1s</div>
                            <div className="text-indigo-200">Update Finality</div>
                        </div>
                        <div>
                            <div className="text-4xl md:text-5xl font-bold text-white mb-2">$0.001</div>
                            <div className="text-indigo-200">Average Transaction Cost</div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}