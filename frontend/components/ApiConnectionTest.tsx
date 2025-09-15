'use client'

import { useState, useEffect } from 'react'
import { api } from '@/utils/api'

export function ApiConnectionTest() {
    const [connectionStatus, setConnectionStatus] = useState<'testing' | 'success' | 'error'>('testing')
    const [healthData, setHealthData] = useState<any>(null)
    const [error, setError] = useState<string>('')

    useEffect(() => {
        testConnection()
    }, [])

    const testConnection = async () => {
        try {
            console.log('Testing API connection...')
            setConnectionStatus('testing')

            // Test the API connection
            const result = await api.testConnection()
            console.log('API test result:', result)

            setHealthData(result)
            setConnectionStatus('success')
        } catch (err: any) {
            console.error('API connection failed:', err)
            setError(err.message)
            setConnectionStatus('error')
        }
    }

    return (
        <div className="fixed bottom-4 left-4 bg-white border rounded-lg p-4 shadow-lg max-w-sm">
            <h3 className="font-bold mb-2">API Connection Status</h3>

            <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${connectionStatus === 'success' ? 'bg-green-500' :
                        connectionStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                <span className="text-sm">
                    {connectionStatus === 'success' ? 'Connected' :
                        connectionStatus === 'error' ? 'Failed' : 'Testing...'}
                </span>
            </div>

            {error && (
                <div className="text-red-600 text-xs mb-2">
                    Error: {error}
                </div>
            )}

            {healthData && (
                <div className="text-xs text-gray-600">
                    <div>Status: {healthData.status || 'Unknown'}</div>
                    <div>Timestamp: {healthData.timestamp}</div>
                </div>
            )}

            <button
                onClick={testConnection}
                className="text-xs bg-blue-500 text-white px-2 py-1 rounded mt-2"
            >
                Test Again
            </button>
        </div>
    )
}