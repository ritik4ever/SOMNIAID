'use client'

import Link from 'next/link'
import { Github, Twitter, MessageCircle, ExternalLink } from 'lucide-react'

export function Footer() {
    return (
        <footer className="bg-gray-900 text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div className="col-span-1 md:col-span-2">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center">
                                <span className="text-white font-bold text-lg">S</span>
                            </div>
                            <span className="text-2xl font-bold">SomniaID</span>
                        </div>
                        <p className="text-gray-400 mb-6 max-w-md">
                            The first real-time reputation NFT platform built on Somnia Network.
                            Your identity, evolving at the speed of thought.
                        </p>
                        <div className="flex space-x-4">
                            <a
                                href="https://github.com/ritik4ever/SOMNIAID"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                            >
                                <Github className="w-5 h-5" />
                            </a>

                            <a
                                href="https://twitter.com/somniaID"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                            >
                                <Twitter className="w-5 h-5" />
                            </a>

                            <a
                                href="https://t.me/+XHq0F0JXMyhmMzM0"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                            >
                                <MessageCircle className="w-5 h-5" />
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="font-semibold mb-4">Platform</h3>
                        <ul className="space-y-2">
                            <li>
                                <Link
                                    href="/explore"
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    Explore Identities
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/leaderboard"
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    Leaderboard
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/dashboard"
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    Dashboard
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Somnia Network */}
                    <div>
                        <h3 className="font-semibold mb-4">Somnia Network</h3>
                        <ul className="space-y-2">
                            <li>
                                <a
                                    href="https://docs.somnia.network/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-400 hover:text-white transition-colors flex items-center space-x-1"
                                >
                                    <span>Documentation</span>
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://testnet.somnia.network/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-400 hover:text-white transition-colors flex items-center space-x-1"
                                >
                                    <span>Faucet</span>
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://shannon-explorer.somnia.network/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-400 hover:text-white transition-colors flex items-center space-x-1"
                                >
                                    <span>Explorer</span>
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
                    <p className="text-gray-400 text-sm">
                        © 2025 SomniaID. Built for the Somnia DeFi Mini Hackathon.
                    </p>
                    <div className="flex items-center space-x-4 mt-4 md:mt-0">
                        <span className="text-gray-400 text-sm">Powered by</span>
                        <a
                            href="https://somnia.network"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300 font-medium text-sm"
                        >
                            Somnia Network
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    )
}