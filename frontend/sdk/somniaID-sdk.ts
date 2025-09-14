import { ethers } from 'ethers';

interface SomniaIDConfig {
    apiUrl: string;
    contractAddress: string;
    rpcUrl: string;
    chainId: number;
}

interface UserIdentity {
    tokenId: number;
    username: string;
    primarySkill: string;
    reputationScore: number;
    skillLevel: number;
    achievementCount: number;
    isVerified: boolean;
    currentPrice: number;
    profile?: any;
    ownerAddress: string;
}

interface Achievement {
    id: string;
    title: string;
    description: string;
    category: string;
    points: number;
    dateAchieved: Date;
    verified: boolean;
}

/**
 * SomniaID SDK - Cross-platform integration for dApps
 * 
 * @example
 * ```typescript
 * import { SomniaIDSDK } from '@somnia/somniaID-sdk';
 * 
 * const sdk = new SomniaIDSDK({
 *   apiUrl: 'https://api.somniaID.com',
 *   contractAddress: '0x...',
 *   rpcUrl: 'https://dream-rpc.somnia.network/',
 *   chainId: 2648
 * });
 * 
 * // Get user identity
 * const identity = await sdk.getIdentityByAddress('0x...');
 * 
 * // Award achievement
 * await sdk.awardAchievement('0x...', {
 *   title: 'DeFi Expert',
 *   category: 'defi',
 *   points: 100
 * });
 * ```
 */
export class SomniaIDSDK {
    private config: SomniaIDConfig;
    private provider: ethers.JsonRpcProvider;
    private contract?: ethers.Contract;

    constructor(config: SomniaIDConfig) {
        this.config = config;
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);

        if (config.contractAddress) {
            const abi = [
                "function getIdentityByAddress(address owner) external view returns (uint256)",
                "function tokenURI(uint256 tokenId) external view returns (string)",
                "function awardAchievement(uint256 tokenId, string memory achievementData) external",
                "function updateReputation(uint256 tokenId, uint256 newReputation) external"
            ];

            this.contract = new ethers.Contract(config.contractAddress, abi, this.provider);
        }
    }

    /**
     * Get user identity by wallet address
     */
    async getIdentityByAddress(address: string): Promise<UserIdentity | null> {
        try {
            const response = await this.apiRequest(`/identity/by-address/${address}`);
            return response.success ? response.data : null;
        } catch (error) {
            console.error('Error fetching identity:', error);
            return null;
        }
    }

    /**
     * Get user identity by tokenId
     */
    async getIdentityByTokenId(tokenId: number): Promise<UserIdentity | null> {
        try {
            const response = await this.apiRequest(`/identity/${tokenId}`);
            return response.success ? response.data : null;
        } catch (error) {
            console.error('Error fetching identity:', error);
            return null;
        }
    }

    /**
     * Get user's reputation score
     */
    async getReputationScore(address: string): Promise<number> {
        const identity = await this.getIdentityByAddress(address);
        return identity?.reputationScore || 0;
    }

    /**
     * Check if user has minimum reputation
     */
    async hasMinimumReputation(address: string, minReputation: number): Promise<boolean> {
        const score = await this.getReputationScore(address);
        return score >= minReputation;
    }

    /**
     * Get user's skill level
     */
    async getSkillLevel(address: string): Promise<number> {
        const identity = await this.getIdentityByAddress(address);
        return identity?.skillLevel || 1;
    }

    /**
     * Check if user is verified
     */
    async isVerified(address: string): Promise<boolean> {
        const identity = await this.getIdentityByAddress(address);
        return identity?.isVerified || false;
    }

    /**
     * Get user's achievements
     */
    async getAchievements(address: string): Promise<Achievement[]> {
        const identity = await this.getIdentityByAddress(address);
        return identity?.profile?.achievements || [];
    }

    /**
     * Check if user has specific achievement
     */
    async hasAchievement(address: string, achievementId: string): Promise<boolean> {
        const achievements = await this.getAchievements(address);
        return achievements.some(a => a.id === achievementId);
    }

    /**
     * Award achievement to user (requires API key)
     */
    async awardAchievement(
        address: string,
        achievement: {
            title: string;
            description?: string;
            category: string;
            points: number;
            proof?: string;
        },
        apiKey?: string
    ): Promise<boolean> {
        try {
            const identity = await this.getIdentityByAddress(address);
            if (!identity) {
                throw new Error('User identity not found');
            }

            const response = await this.apiRequest('/achievements/award', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(apiKey && { 'X-API-Key': apiKey })
                },
                body: JSON.stringify({
                    tokenId: identity.tokenId,
                    achievement: {
                        ...achievement,
                        id: `external_${Date.now()}`,
                        dateAchieved: new Date(),
                        verified: false // Will be verified by SomniaID team
                    }
                })
            });

            return response.success;
        } catch (error) {
            console.error('Error awarding achievement:', error);
            return false;
        }
    }

    /**
     * Get user's NFT metadata
     */
    async getNFTMetadata(tokenId: number): Promise<any> {
        try {
            const response = await this.apiRequest(`/nft/metadata/${tokenId}`);
            return response.success ? response.data : null;
        } catch (error) {
            console.error('Error fetching NFT metadata:', error);
            return null;
        }
    }

    /**
     * Get top users by reputation
     */
    async getTopUsers(limit = 10): Promise<UserIdentity[]> {
        try {
            const response = await this.apiRequest(`/leaderboard?limit=${limit}`);
            return response.success ? response.data : [];
        } catch (error) {
            console.error('Error fetching top users:', error);
            return [];
        }
    }

    /**
     * Search users by skill or username
     */
    async searchUsers(query: string, limit = 20): Promise<UserIdentity[]> {
        try {
            const response = await this.apiRequest(`/identity/search?q=${encodeURIComponent(query)}&limit=${limit}`);
            return response.success ? response.data : [];
        } catch (error) {
            console.error('Error searching users:', error);
            return [];
        }
    }

    /**
     * Get user analytics
     */
    async getUserAnalytics(address: string): Promise<any> {
        try {
            const identity = await this.getIdentityByAddress(address);
            if (!identity) return null;

            const response = await this.apiRequest(`/analytics/user/${identity.tokenId}`);
            return response.success ? response.data : null;
        } catch (error) {
            console.error('Error fetching user analytics:', error);
            return null;
        }
    }

    /**
     * Subscribe to real-time updates
     */
    subscribeToUpdates(callbacks: {
        onReputationUpdate?: (data: any) => void;
        onAchievementUnlocked?: (data: any) => void;
        onIdentityCreated?: (data: any) => void;
    }): () => void {
        if (typeof window === 'undefined') {
            console.warn('Real-time updates only available in browser environment');
            return () => { };
        }

        // Use Socket.IO or WebSocket connection
        const ws = new WebSocket(`wss://${new URL(this.config.apiUrl).host}/ws`);

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            switch (data.type) {
                case 'reputation_update':
                    callbacks.onReputationUpdate?.(data);
                    break;
                case 'achievement_unlocked':
                    callbacks.onAchievementUnlocked?.(data);
                    break;
                case 'identity_created':
                    callbacks.onIdentityCreated?.(data);
                    break;
            }
        };

        return () => ws.close();
    }

    /**
     * Verify user ownership of address
     */
    async verifyAddressOwnership(address: string, signature: string, message: string): Promise<boolean> {
        try {
            const recoveredAddress = ethers.verifyMessage(message, signature);
            return recoveredAddress.toLowerCase() === address.toLowerCase();
        } catch (error) {
            console.error('Error verifying address ownership:', error);
            return false;
        }
    }

    /**
     * Get integration statistics
     */
    async getIntegrationStats(): Promise<any> {
        try {
            const response = await this.apiRequest('/stats/integration');
            return response.success ? response.data : null;
        } catch (error) {
            console.error('Error fetching integration stats:', error);
            return null;
        }
    }

    /**
     * Batch operations for multiple users
     */
    async batchGetIdentities(addresses: string[]): Promise<(UserIdentity | null)[]> {
        try {
            const response = await this.apiRequest('/identity/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ addresses })
            });

            return response.success ? response.data : [];
        } catch (error) {
            console.error('Error fetching batch identities:', error);
            return [];
        }
    }

    /**
     * Make authenticated API request
     */
    private async apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
        const url = `${this.config.apiUrl}${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Utility methods for common integrations
     */

    // Gate content based on reputation
    async gateByReputation(address: string, minReputation: number): Promise<boolean> {
        return await this.hasMinimumReputation(address, minReputation);
    }

    // Gate content based on verification status
    async gateByVerification(address: string): Promise<boolean> {
        return await this.isVerified(address);
    }

    // Gate content based on specific achievement
    async gateByAchievement(address: string, achievementId: string): Promise<boolean> {
        return await this.hasAchievement(address, achievementId);
    }

    // Gate content based on skill level
    async gateBySkillLevel(address: string, minLevel: number): Promise<boolean> {
        const level = await this.getSkillLevel(address);
        return level >= minLevel;
    }

    // Get user's reputation tier
    async getReputationTier(address: string): Promise<'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'> {
        const score = await this.getReputationScore(address);

        if (score >= 2500) return 'diamond';
        if (score >= 1000) return 'platinum';
        if (score >= 500) return 'gold';
        if (score >= 200) return 'silver';
        return 'bronze';
    }
}

// Export utility functions for easy integration
export const SomniaIDUtils = {
    // Format reputation score for display
    formatReputation(score: number): string {
        if (score >= 1000000) return `${(score / 1000000).toFixed(1)}M`;
        if (score >= 1000) return `${(score / 1000).toFixed(1)}K`;
        return score.toString();
    },

    // Get reputation color based on score
    getReputationColor(score: number): string {
        if (score >= 2500) return '#9333ea'; // purple
        if (score >= 1000) return '#dc2626'; // red
        if (score >= 500) return '#ea580c'; // orange
        if (score >= 200) return '#16a34a'; // green
        return '#6b7280'; // gray
    },

    // Generate achievement badge URL
    getAchievementBadgeUrl(achievementId: string): string {
        return `https://cdn.somniaID.com/badges/${achievementId}.svg`;
    }
};

// Default configuration for Somnia Network
export const SOMNIA_TESTNET_CONFIG: SomniaIDConfig = {
    apiUrl: 'https://api.somniaID.com',
    contractAddress: '0xbeAe9159aFC070071328648dDc85d873AD5070a0',
    rpcUrl: 'https://dream-rpc.somnia.network/',
    chainId: 2648
};

export default SomniaIDSDK;