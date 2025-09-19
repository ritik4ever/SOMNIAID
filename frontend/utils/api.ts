import toast from 'react-hot-toast';

// Use production API URL in production
export const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://somniaid.onrender.com';

// Add proper interfaces
interface LeaderboardResponse {
    success: boolean;
    leaderboard: Array<{
        rank: number;
        tokenId: number;
        username: string;
        reputationScore: number;
        achievementCount: number;
        achievements: any[];
    }>;
    pagination: {
        page: number;
        limit: number;
        hasMore: boolean;
    };
}

interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    // Add these for direct response properties
    leaderboard?: any;
    pagination?: any;
    identities?: any;
    results?: any;
    identity?: any;
    blockchainVerified?: boolean;
}

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
        console.log('API Client initialized with baseURL:', this.baseUrl);
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
        try {
            const url = `${this.baseUrl}${endpoint}`;

            console.log(`API Request: ${options.method || 'GET'} ${url}`);

            const config: RequestInit = {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
                ...options,
            };

            // Add auth token if available (only in browser)
            if (typeof window !== 'undefined') {
                const token = localStorage.getItem('auth_token');
                if (token) {
                    config.headers = {
                        ...config.headers,
                        Authorization: `Bearer ${token}`,
                    };
                }
            }

            const response = await fetch(url, config);

            console.log(`API Response: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                // Try to get error message from response
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.message || errorMessage;
                } catch {
                    // If can't parse JSON, use default message
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();

            return {
                success: true,
                ...data, // Spread the response data directly
            };
        } catch (error: any) {
            console.error(`API Error for ${this.baseUrl}${endpoint}:`, error);

            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                return {
                    success: false,
                    error: 'Unable to connect to server. Please check your internet connection and try again.',
                };
            }

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    // Auth endpoints
    async verifyWallet(address: string, signature: string, message: string) {
        return this.request('/auth/verify', {
            method: 'POST',
            body: JSON.stringify({ address, signature, message }),
        });
    }

    async login(address: string, signature: string) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ address, signature }),
        });
    }

    async getProfile() {
        return this.request('/auth/profile');
    }

    async updateProfile(profileData: any) {
        return this.request('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData),
        });
    }

    // ENHANCED: Identity endpoints with blockchain sync
    async getIdentities(page = 1, limit = 20, verifyBlockchain = false) {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            verifyBlockchain: verifyBlockchain.toString()
        });

        return this.request(`/identity?${params}`);
    }

    async getIdentity(tokenId: number) {
        return this.request(`/identity/${tokenId}`);
    }

    // NEW: Blockchain-first identity lookup
    async getIdentityBlockchain(address: string) {
        return this.request(`/identity/blockchain/${address}`);
    }

    // ENHANCED: Create identity with blockchain sync support
    async createIdentity(username: string, primarySkill: string, profileData?: string, ownerAddress?: string, txHash?: string) {
        console.log('Creating identity with:', {
            username,
            primarySkill,
            hasProfileData: !!profileData,
            hasOwnerAddress: !!ownerAddress,
            hasTxHash: !!txHash
        });

        return this.request('/identity/create', {
            method: 'POST',
            body: JSON.stringify({
                username: username.trim(),
                primarySkill: primarySkill.trim(),
                bio: profileData || '',
                ownerAddress: ownerAddress,
                txHash: txHash
            }),
        });
    }

    async createIdentityEnhanced(identityData: any) {
        return this.request('/identity/create-enhanced', {
            method: 'POST',
            body: JSON.stringify(identityData),
        });
    }

    async updateIdentity(tokenId: number, data: any) {
        return this.request(`/identity/${tokenId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        })
    }

    // NEW: Manual blockchain sync
    async syncBlockchain(address?: string) {
        return this.request('/identity/sync-blockchain', {
            method: 'POST',
            body: JSON.stringify({ address })
        });
    }

    async getPortfolio(address: string) {
        return this.request(`/portfolio/${address}`)
    }

    async getMarketplace(page = 1, limit = 20) {
        return this.request(`/marketplace?page=${page}&limit=${limit}`)
    }

    async searchIdentities(query: string) {
        return this.request(`/identity/search/${encodeURIComponent(query)}`);
    }

    // Achievement endpoints
    async getAchievements(tokenId?: number, page = 1, limit = 20) {
        if (tokenId) {
            return this.request(`/achievements/${tokenId}`);
        }
        return this.request(`/achievements?page=${page}&limit=${limit}`);
    }

    async addAchievement(tokenId: number, achievement: any) {
        return this.request('/achievements/add', {
            method: 'POST',
            body: JSON.stringify({ tokenId, achievement }),
        })
    }

    async createAchievement(data: any) {
        return this.request('/achievements/create', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getAvailableAchievements() {
        return this.request('/achievements/available');
    }

    async getLeaderboard(page = 1, limit = 10): Promise<ApiResponse<LeaderboardResponse>> {
        return this.request(`/achievements/leaderboard?page=${page}&limit=${limit}`);
    }

    // Marketplace endpoints
    async getMarketplaceListings(params?: { page?: number; limit?: number; sortBy?: string }) {
        const query = new URLSearchParams(params as any).toString();
        return this.request(`/marketplace/listings?${query}`);
    }

    async listNFT(tokenId: number, price: number, sellerAddress: string) {
        return this.request('/marketplace/list', {
            method: 'POST',
            body: JSON.stringify({ tokenId, price, sellerAddress }),
        });
    }

    async getMarketplaceListing(tokenId: number) {
        return this.request(`/marketplace/listing/${tokenId}`);
    }

    async unlistNFT(tokenId: number, sellerAddress: string) {
        return this.request('/marketplace/unlist', {
            method: 'POST',
            body: JSON.stringify({ tokenId, sellerAddress }),
        });
    }

    // NFT endpoints
    async buyNFT(tokenId: number, buyerAddress: string, txHash: string) {
        return this.request(`/nft/buy/${tokenId}`, {
            method: 'POST',
            body: JSON.stringify({ buyerAddress, txHash }),
        });
    }

    async getNFT(tokenId: number) {
        return this.request(`/nft/${tokenId}`);
    }

    async getAllNFTs(params?: { page?: number; limit?: number; skill?: string }) {
        const query = new URLSearchParams(params as any).toString();
        return this.request(`/nft?${query}`);
    }

    // Health check endpoints
    async testConnection() {
        try {
            // Try the API health endpoint first
            const apiHealth = await this.request('/test');
            if (apiHealth.success) {
                return apiHealth;
            }

            // Fallback to main health endpoint
            const baseUrl = this.baseUrl.replace('/api', '');
            const response = await fetch(`${baseUrl}/health`);
            if (!response.ok) {
                throw new Error(`Health check failed: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Connection test failed:', error);
            throw new Error('Backend server is not accessible');
        }
    }

    // NEW: Debug endpoints
    async debugTokenId(address: string) {
        return this.request('/identity/debug-token', {
            method: 'POST',
            body: JSON.stringify({ address })
        });
    }

    async getAllBlockchainIdentities() {
        return this.request('/identity/blockchain/all');
    }
}

export const api = new ApiClient(API_BASE_URL);

// Export separate API objects for backward compatibility
export const marketplaceAPI = {
    getListings: (params?: { page?: number; limit?: number; sortBy?: string }) =>
        api.getMarketplaceListings(params),
    listNFT: (tokenId: number, price: number, sellerAddress: string) =>
        api.listNFT(tokenId, price, sellerAddress),
    getListing: (tokenId: number) =>
        api.getMarketplaceListing(tokenId),
    unlistNFT: (tokenId: number, sellerAddress: string) =>
        api.unlistNFT(tokenId, sellerAddress)
};

export const nftAPI = {
    buyNFT: (tokenId: number, buyerAddress: string, txHash: string) =>
        api.buyNFT(tokenId, buyerAddress, txHash),
    getNFT: (tokenId: number) =>
        api.getNFT(tokenId),
    getAllNFTs: (params?: { page?: number; limit?: number; skill?: string }) =>
        api.getAllNFTs(params)
};