import toast from 'react-hot-toast';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

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
}

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
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

            // Add auth token if available
            const token = localStorage.getItem('auth_token');
            if (token) {
                config.headers = {
                    ...config.headers,
                    Authorization: `Bearer ${token}`,
                };
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
                    error: 'Unable to connect to server. Please make sure the backend is running.',
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

    // Identity endpoints
    async getIdentities(page = 1, limit = 20) {
        return this.request(`/identity?page=${page}&limit=${limit}`);
    }

    async getIdentity(tokenId: number) {
        return this.request(`/identity/${tokenId}`);
    }

    async createIdentityEnhanced(identityData: any) {
        return this.request('/identity/create-enhanced', {
            method: 'POST',
            body: JSON.stringify(identityData),
        });
    }

    async createIdentity(username: string, primarySkill: string, bio?: string) {
        console.log('Creating identity with:', { username, primarySkill, bio });
        return this.request('/identity/create', {
            method: 'POST',
            body: JSON.stringify({ username, primarySkill, bio }),
        });
    }

    async updateIdentity(tokenId: number, data: any) {
        return this.request(`/identity/${tokenId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
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
        return this.request(`/achievements/${tokenId}/add`, {
            method: 'POST',
            body: JSON.stringify(achievement),
        });
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

    // Utility method to test connection
    async testConnection() {
        try {
            const response = await fetch(`${this.baseUrl.replace('/api', '')}/health`);
            return await response.json();
        } catch (error) {
            throw new Error('Backend server is not accessible');
        }
    }
}

export const api = new ApiClient(API_BASE_URL);