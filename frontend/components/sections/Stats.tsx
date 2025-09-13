'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

const stats = [
    { label: 'Identities Created', value: 1247, suffix: '+', color: 'from-blue-400 to-indigo-500' },
    { label: 'Reputation Points', value: 892341, suffix: '+', color: 'from-purple-400 to-pink-500' },
    { label: 'Achievements Unlocked', value: 5683, suffix: '+', color: 'from-green-400 to-emerald-500' },
    { label: 'Daily Active Users', value: 423, suffix: '+', color: 'from-yellow-400 to-orange-500' }
]

function AnimatedNumber({ value, duration = 2000 }: { value: number, duration?: number }) {
    const [count, setCount] = useState(0)

    useEffect(() => {
        let startTime: number
        let animationFrame: number

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp
            const progress = Math.min((timestamp - startTime) / duration, 1)

            setCount(Math.floor(progress * value))

            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate)
            }
        }

        animationFrame = requestAnimationFrame(animate)

        return () => {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame)
            }
        }
    }, [value, duration])

    return <span>{count.toLocaleString()}</span>
}

export function Stats() {
    return (
        <section className="py-16 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-center mb-12"
                >
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                        Growing at Somnia Speed
                    </h2>
                    <p className="text-xl text-gray-600">
                        Real metrics from our rapidly expanding community
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {stats.map((stat, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: index * 0.1 }}
                            className="text-center"
                        >
                            <div className="relative">
                                <div className={`text-4xl md:text-5xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent mb-2`}>
                                    <AnimatedNumber value={stat.value} />
                                    {stat.suffix}
                                </div>
                                <div className="text-gray-600 font-medium">{stat.label}</div>

                                {/* Animated background */}
                                <div className={`absolute -inset-4 bg-gradient-to-r ${stat.color} opacity-5 rounded-2xl -z-10`} />
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Real-time indicator */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                    className="text-center mt-8"
                >
                    <div className="inline-flex items-center space-x-2 bg-green-50 text-green-700 px-4 py-2 rounded-full">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-sm font-medium">Live data • Updates every second</span>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}