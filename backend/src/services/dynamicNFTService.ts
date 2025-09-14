import { ethers } from 'ethers';
import Identity from '../models/Identity';

interface NFTMetadata {
    name: string;
    description: string;
    image: string;
    attributes: Array<{
        trait_type: string;
        value: string | number;
        display_type?: string;
    }>;
    properties: {
        reputation_score: number;
        skill_level: number;
        achievement_count: number;
        verification_status: boolean;
        created_date: string;
        last_updated: string;
    };
}

class DynamicNFTService {
    private provider: ethers.JsonRpcProvider;
    private contract?: ethers.Contract; // Make optional
    private baseImageURL: string = 'https://api.somniaID.com/images';

    constructor() {
        const rpcUrl = process.env.RPC_URL || 'https://dream-rpc.somnia.network/';
        this.provider = new ethers.JsonRpcProvider(rpcUrl);

        if (process.env.CONTRACT_ADDRESS) {
            const contractABI = [
                "function updateTokenURI(uint256 tokenId, string memory newTokenURI) external",
                "function tokenURI(uint256 tokenId) external view returns (string)",
                "function getTokenMetadata(uint256 tokenId) external view returns (string)",
                "event MetadataUpdate(uint256 indexed tokenId, string newURI)"
            ];

            try {
                this.contract = new ethers.Contract(
                    process.env.CONTRACT_ADDRESS,
                    contractABI,
                    this.provider
                );
            } catch (error) {
                console.warn('Contract initialization failed:', error);
            }
        }
    }

    // Generate dynamic NFT image based on user stats
    private generateImageURL(identity: any): string {
        const params = new URLSearchParams({
            username: identity.username,
            skill: identity.primarySkill,
            level: identity.skillLevel.toString(),
            reputation: identity.reputationScore.toString(),
            achievements: identity.achievementCount.toString(),
            verified: identity.isVerified.toString()
        });

        return `${this.baseImageURL}/generate?${params.toString()}`;
    }

    // Generate complete NFT metadata
    async generateMetadata(tokenId: number): Promise<NFTMetadata> {
        const identity = await Identity.findOne({ tokenId });
        if (!identity) {
            throw new Error('Identity not found');
        }

        const metadata: NFTMetadata = {
            name: `${identity.username} - SomniaID #${tokenId}`,
            description: `Dynamic reputation NFT for ${identity.username}. ${identity.profile?.bio || 'Building the future on Somnia Network.'}`,
            image: this.generateImageURL(identity),
            attributes: [
                {
                    trait_type: "Reputation Score",
                    value: identity.reputationScore,
                    display_type: "number"
                },
                {
                    trait_type: "Skill Level",
                    value: identity.skillLevel,
                    display_type: "number"
                },
                {
                    trait_type: "Primary Skill",
                    value: identity.primarySkill
                },
                {
                    trait_type: "Experience Level",
                    value: identity.experience || 'beginner'
                },
                {
                    trait_type: "Achievement Count",
                    value: identity.achievementCount,
                    display_type: "number"
                },
                {
                    trait_type: "Verification Status",
                    value: identity.isVerified ? "Verified" : "Unverified"
                },
                {
                    trait_type: "NFT Value",
                    value: identity.currentPrice,
                    display_type: "number"
                }
            ],
            properties: {
                reputation_score: identity.reputationScore,
                skill_level: identity.skillLevel,
                achievement_count: identity.achievementCount,
                verification_status: identity.isVerified,
                created_date: identity.createdAt?.toISOString() || new Date().toISOString(),
                last_updated: new Date(identity.lastUpdate).toISOString()
            }
        };

        // Add achievement-specific attributes
        if (identity.profile?.achievements?.length > 0) {
            const hackathonWins = identity.profile.achievements.filter(a => a.category === 'hackathon').length;
            const certifications = identity.profile.achievements.filter(a => a.category === 'certification').length;

            if (hackathonWins > 0) {
                metadata.attributes.push({
                    trait_type: "Hackathon Wins",
                    value: hackathonWins,
                    display_type: "number"
                });
            }

            if (certifications > 0) {
                metadata.attributes.push({
                    trait_type: "Certifications",
                    value: certifications,
                    display_type: "number"
                });
            }
        }

        // Add skill-specific attributes
        if (identity.profile?.skills?.length > 0) {
            metadata.attributes.push({
                trait_type: "Skill Count",
                value: identity.profile.skills.length,
                display_type: "number"
            });
        }

        return metadata;
    }

    // Update NFT metadata on-chain
    async updateOnChainMetadata(tokenId: number, privateKey?: string): Promise<boolean> {
        try {
            if (!this.contract || !privateKey) {
                console.log('Contract or private key not available, skipping on-chain update');
                return false;
            }

            // Generate new metadata
            const metadata = await this.generateMetadata(tokenId);

            // Upload metadata to IPFS or decentralized storage
            const metadataURI = await this.uploadMetadata(metadata);

            // Create wallet instance
            const wallet = new ethers.Wallet(privateKey, this.provider);
            const contractWithSigner = this.contract.connect(wallet);

            // Check if contract has the updateTokenURI method
            if ('updateTokenURI' in contractWithSigner) {
                const tx = await (contractWithSigner as any).updateTokenURI(tokenId, metadataURI);
                await tx.wait();

                console.log(`NFT metadata updated on-chain for token ${tokenId}: ${tx.hash}`);
                return true;
            } else {
                console.warn('Contract does not have updateTokenURI method');
                return false;
            }
        } catch (error) {
            console.error('Error updating on-chain metadata:', error);
            return false;
        }
    }

    // Upload metadata to IPFS (simplified version)
    private async uploadMetadata(metadata: NFTMetadata): Promise<string> {
        // In production, integrate with IPFS or Arweave
        // For now, return a mock URI
        const metadataString = JSON.stringify(metadata, null, 2);
        const hash = ethers.keccak256(ethers.toUtf8Bytes(metadataString)).slice(2, 10);
        return `https://gateway.pinata.cloud/ipfs/Qm${hash}`;
    }

    // Get current on-chain metadata
    async getOnChainMetadata(tokenId: number): Promise<string | null> {
        try {
            if (!this.contract) return null;

            if ('tokenURI' in this.contract) {
                const tokenURI = await (this.contract as any).tokenURI(tokenId);
                return tokenURI;
            }
            return null;
        } catch (error) {
            console.error('Error getting on-chain metadata:', error);
            return null;
        }
    }

    // Schedule automatic metadata updates
    async scheduleMetadataUpdate(tokenId: number) {
        try {
            const identity = await Identity.findOne({ tokenId });
            if (!identity) return;

            // Update metadata when significant changes occur
            const shouldUpdate = this.shouldUpdateMetadata(identity);

            if (shouldUpdate) {
                await this.updateOnChainMetadata(tokenId);

                // Update last metadata refresh timestamp
                identity.lastMetadataUpdate = Date.now();
                await identity.save();
            }
        } catch (error) {
            console.error('Error scheduling metadata update:', error);
        }
    }

    // Determine if metadata should be updated
    private shouldUpdateMetadata(identity: any): boolean {
        const lastUpdate = identity.lastMetadataUpdate || 0;
        const timeSinceUpdate = Date.now() - lastUpdate;
        const oneHour = 60 * 60 * 1000;

        // Update if:
        // 1. Never updated before
        // 2. Major reputation change (>50 points)
        // 3. New achievement unlocked
        // 4. More than 1 hour since last update and there are changes

        return (
            lastUpdate === 0 ||
            timeSinceUpdate > oneHour ||
            identity.reputationScore > (identity.lastKnownReputation || 0) + 50
        );
    }

    // Batch update metadata for multiple tokens
    async batchUpdateMetadata(tokenIds: number[]) {
        const results = [];

        for (const tokenId of tokenIds) {
            try {
                const success = await this.updateOnChainMetadata(tokenId);
                results.push({ tokenId, success });

                // Add delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results.push({ tokenId, success: false, error: errorMessage });
            }
        }

        return results;
    }
}

export default DynamicNFTService;