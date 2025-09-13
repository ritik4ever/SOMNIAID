'use client'

import { useState } from 'react'
import { api } from '@/utils/api'

export function APITest() {
    const [status, setStatus] = useState<string>('Not tested')

    const testAPI = async () => {
        try {
            setStatus('Testing...')
            const result = await api.testConnection()
            setStatus(`✅ Connected: ${JSON.stringify(result)}`)
        } catch (error: any) {
            setStatus(`❌ Error: ${error.message}`)
        }
    }

    return (
        <div className="p-4 bg-gray-100 rounded">
            <button
                onClick={testAPI}
                className="px-4 py-2 bg-blue-500 text-white rounded mr-4"
            >
                Test API Connection
            </button>
            <span className="text-sm">{status}</span>
        </div>
    )
}