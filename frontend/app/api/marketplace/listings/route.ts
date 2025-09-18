// frontend/app/api/marketplace/listings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, formatEther } from 'viem'
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/utils/contract'

const publicClient = createPublicClient({
    chain: {
        id: 50312,
        name: 'Somnia Testnet',
        nativeCurrency: { decimals: 18, name: 'STT', symbol: 'STT' },
        rpcUrls: { default: { http: ['https://dream-rpc.somnia.network/'] } }
    },
    transport: http('https://dream-rpc.somnia.network/')
})

export async function GET(request: NextRequest) {
    try {
        console.log('🏪 Fetching marketplace listings...');

        let listings: any[] = [];

        console.log('🔄 Using manual token check (since getListedIdentities not in ABI)...');

        try {
            const totalIdentities = await publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getTotalIdentities',
                args: []
            }) as bigint;

            console.log(`🔍 Checking ${totalIdentities} total identities for listings...`);

            // Check each token for listings
            const maxCheck = Math.min(Number(totalIdentities), 10); // Limit to prevent timeout

            for (let tokenId = 0; tokenId < maxCheck; tokenId++) {
                try {
                    // Check if this token is listed (assuming you have this function)
                    let isListed = false;
                    let listPrice = BigInt(0);

                    try {
                        const listingInfo = await publicClient.readContract({
                            address: CONTRACT_ADDRESS,
                            abi: CONTRACT_ABI,
                            functionName: 'getListingInfo',
                            args: [BigInt(tokenId)]
                        }) as [boolean, bigint];

                        isListed = listingInfo[0];
                        listPrice = listingInfo[1];
                    } catch (listingError) {
                        // If getListingInfo doesn't exist, assume not listed
                        console.log(`Token ${tokenId}: No listing info available`);
                        continue;
                    }

                    if (isListed) {
                        console.log(`📋 Token ${tokenId} is listed for ${formatEther(listPrice)} STT`);

                        // Get identity and owner details
                        const [identity, owner] = await Promise.all([
                            publicClient.readContract({
                                address: CONTRACT_ADDRESS,
                                abi: CONTRACT_ABI,
                                functionName: 'getIdentity',
                                args: [BigInt(tokenId)]
                            }) as Promise<any>,
                            publicClient.readContract({
                                address: CONTRACT_ADDRESS,
                                abi: CONTRACT_ABI,
                                functionName: 'ownerOf',
                                args: [BigInt(tokenId)]
                            }) as Promise<string>
                        ]);

                        // Try to get username from backend
                        let username = `Identity #${tokenId}`;
                        try {
                            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
                            const backendResponse = await fetch(`${backendUrl}/api/identity/${tokenId}`, {
                                headers: { 'Content-Type': 'application/json' }
                            });

                            if (backendResponse.ok) {
                                const backendData = await backendResponse.json();
                                if (backendData.success && backendData.identity?.username) {
                                    username = backendData.identity.username;
                                    console.log(`✅ Got username from backend: ${username}`);
                                }
                            }
                        } catch (backendError) {
                            console.log('Backend username fetch failed, using fallback');
                        }

                        // **CRITICAL FIX**: Convert BigInt to string/number before adding to response
                        listings.push({
                            tokenId,
                            username,
                            primarySkill: identity.primarySkill || 'Unknown',
                            reputationScore: Number(identity.reputationScore || 100),
                            skillLevel: Number(identity.skillLevel || 1),
                            achievementCount: Number(identity.achievementCount || 0),
                            isVerified: identity.isVerified || false,
                            currentPrice: listPrice.toString(), // Convert BigInt to string
                            priceInEth: formatEther(listPrice), // This is already a string
                            seller: owner,
                            isListed: true,
                            isForSale: true
                        });
                    }
                } catch (tokenError: any) {
                    console.log(`Error checking token ${tokenId}:`, tokenError?.message || tokenError);
                    continue;
                }
            }

        } catch (manualError) {
            console.error('Manual token check failed:', manualError);
        }

        console.log(`✅ Found ${listings.length} marketplace listings`);

        // Calculate totals
        const totalValue = listings.reduce((sum, item) => sum + parseFloat(item.priceInEth), 0);

        return NextResponse.json({
            success: true,
            listings,
            count: listings.length,
            totalValue,
            avgPrice: listings.length > 0 ? totalValue / listings.length : 0
        });

    } catch (error) {
        console.error('❌ Marketplace API error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch marketplace listings',
            listings: [],
            count: 0,
            totalValue: 0
        });
    }
}