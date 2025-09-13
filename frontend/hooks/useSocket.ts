'use client'

import { useEffect, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { SocketUpdate } from '@/types'

export function useSocket() {
    const [socket, setSocket] = useState<Socket | null>(null)
    const [isConnected, setIsConnected] = useState(false)
    const [updates, setUpdates] = useState<SocketUpdate[]>([])

    useEffect(() => {
        const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000', {
            transports: ['websocket', 'polling']
        })

        socketInstance.on('connect', () => {
            setIsConnected(true)
            console.log('🔗 Connected to server')
        })

        socketInstance.on('disconnect', () => {
            setIsConnected(false)
            console.log('🔌 Disconnected from server')
        })

        socketInstance.on('reputation-updated', (data: any) => {
            const update: SocketUpdate = {
                type: 'reputation',
                tokenId: data.tokenId,
                data,
                timestamp: Date.now()
            }
            setUpdates(prev => [update, ...prev.slice(0, 49)]) // Keep last 50 updates
        })

        socketInstance.on('new-achievement', (data: any) => {
            const update: SocketUpdate = {
                type: 'achievement',
                tokenId: data.tokenId,
                data,
                timestamp: Date.now()
            }
            setUpdates(prev => [update, ...prev.slice(0, 49)])
        })

        socketInstance.on('skill-levelup', (data: any) => {
            const update: SocketUpdate = {
                type: 'levelup',
                tokenId: data.tokenId,
                data,
                timestamp: Date.now()
            }
            setUpdates(prev => [update, ...prev.slice(0, 49)])
        })

        socketInstance.on('global-update', (data: any) => {
            const update: SocketUpdate = {
                type: data.type,
                tokenId: data.tokenId,
                data,
                timestamp: data.timestamp
            }
            setUpdates(prev => [update, ...prev.slice(0, 49)])
        })

        setSocket(socketInstance)

        return () => {
            socketInstance.disconnect()
        }
    }, [])

    const joinIdentityRoom = useCallback((tokenId: string) => {
        if (socket) {
            socket.emit('join-identity', tokenId)
        }
    }, [socket])

    const updateReputation = useCallback((tokenId: string, newScore: number, reason: string) => {
        if (socket) {
            socket.emit('update-reputation', {
                tokenId,
                newScore,
                reason,
                timestamp: Date.now()
            })
        }
    }, [socket])

    const unlockAchievement = useCallback((tokenId: string, achievement: any) => {
        if (socket) {
            socket.emit('achievement-unlocked', {
                tokenId,
                ...achievement
            })
        }
    }, [socket])

    return {
        socket,
        isConnected,
        updates,
        joinIdentityRoom,
        updateReputation,
        unlockAchievement
    }
}