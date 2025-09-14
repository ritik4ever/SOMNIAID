import { ethers } from 'ethers';
import Identity from '../models/Identity';

interface VerificationProof {
    achievementId: string;
    tokenId: number;
    merkleRoot: string;
    merkleProof: string[];
    timestamp: number;
    txHash?: string;
}

interface BlockchainAchievement {
    id: string;
    title: string;
    points: number;
    verificationHash: string;
    timestamp: number;
    verified: boolean;
}

class VerificationService {
    private provider: ethers.JsonRpcProvider;
    private contract?: ethers.Contract; // Make optional
    private verificationWallet?: ethers.Wallet; // Make optional

    constructor() {
        const rpcUrl = process.env.RPC_URL || 'https://dream-rpc.somnia.network/';
        this.provider = new ethers.JsonRpcProvider(rpcUrl);

        // Verification contract ABI
        const verificationABI = [
            "function verifyAchievement(uint256 tokenId, bytes32 achievementHash, bytes32[] calldata merkleProof) external returns (bool)",
            "function batchVerifyAchievements(uint256[] calldata tokenIds, bytes32[] calldata achievementHashes, bytes32[][] calldata merkleProofs) external",
            "function isAchievementVerified(uint256 tokenId, bytes32 achievementHash) external view returns (bool)",
            "function getVerificationProof(uint256 tokenId, bytes32 achievementHash) external view returns (bytes32[] memory)",
            "function updateMerkleRoot(bytes32 newRoot) external",
            "event AchievementVerified(uint256 indexed tokenId, bytes32 indexed achievementHash, uint256 timestamp)",
            "event BatchVerificationComplete(uint256[] tokenIds, bytes32[] achievementHashes)"
        ];

        if (process.env.VERIFICATION_CONTRACT_ADDRESS) {
            try {
                this.contract = new ethers.Contract(
                    process.env.VERIFICATION_CONTRACT_ADDRESS,
                    verificationABI,
                    this.provider
                );
            } catch (error) {
                console.warn('Verification contract initialization failed:', error);
            }
        }

        // Initialize verification wallet (should be secured in production)
        if (process.env.VERIFICATION_PRIVATE_KEY) {
            try {
                this.verificationWallet = new ethers.Wallet(process.env.VERIFICATION_PRIVATE_KEY, this.provider);
            } catch (error) {
                console.warn('Verification wallet initialization failed:', error);
            }
        }
    }

    /**
     * Verify achievement on blockchain
     */
    async verifyAchievementOnChain(
        tokenId: number,
        achievementId: string,
        proof: {
            dataHash: string;
            sourceUrl?: string;
            verifierAddress?: string;
            metadata?: any;
        }
    ): Promise<boolean> {
        try {
            if (!this.contract || !this.verificationWallet) {
                console.log('Verification contract not available');
                return false;
            }

            // Generate achievement hash
            const achievementHash = this.generateAchievementHash(achievementId, proof);

            // Generate merkle proof (simplified - in production, use proper merkle tree)
            const merkleProof = await this.generateMerkleProof(tokenId, achievementHash);

            // Call verification contract
            const contractWithSigner = this.contract.connect(this.verificationWallet);

            if ('verifyAchievement' in contractWithSigner) {
                const tx = await (contractWithSigner as any).verifyAchievement(
                    tokenId,
                    achievementHash,
                    merkleProof
                );

                const receipt = await tx.wait();

                // Update database with verification
                await this.updateDatabaseVerification(tokenId, achievementId, {
                    txHash: receipt.hash,
                    blockNumber: receipt.blockNumber,
                    verificationHash: achievementHash,
                    verified: true
                });

                console.log(`Achievement verified on-chain: ${achievementId} for token ${tokenId}`);
                return true;
            } else {
                console.warn('Contract does not have verifyAchievement method');
                return false;
            }
        } catch (error) {
            console.error('Error verifying achievement on-chain:', error);
            return false;
        }
    }

    /**
     * Batch verify multiple achievements
     */
    async batchVerifyAchievements(verifications: Array<{
        tokenId: number;
        achievementId: string;
        proof: any;
    }>): Promise<boolean> {
        try {
            if (!this.contract || !this.verificationWallet) return false;

            const tokenIds = verifications.map(v => v.tokenId);
            const achievementHashes = verifications.map(v =>
                this.generateAchievementHash(v.achievementId, v.proof)
            );
            const merkleProofs = await Promise.all(
                verifications.map(v => this.generateMerkleProof(v.tokenId,
                    this.generateAchievementHash(v.achievementId, v.proof)))
            );

            const contractWithSigner = this.contract.connect(this.verificationWallet);

            if ('batchVerifyAchievements' in contractWithSigner) {
                const tx = await (contractWithSigner as any).batchVerifyAchievements(
                    tokenIds,
                    achievementHashes,
                    merkleProofs
                );

                await tx.wait();

                // Update all verifications in database
                for (let i = 0; i < verifications.length; i++) {
                    await this.updateDatabaseVerification(
                        verifications[i].tokenId,
                        verifications[i].achievementId,
                        {
                            txHash: tx.hash,
                            verificationHash: achievementHashes[i],
                            verified: true
                        }
                    );
                }

                console.log(`Batch verified ${verifications.length} achievements`);
                return true;
            } else {
                console.warn('Contract does not have batchVerifyAchievements method');
                return false;
            }
        } catch (error) {
            console.error('Error batch verifying achievements:', error);
            return false;
        }
    }

    /**
     * Check if achievement is verified on blockchain
     */
    async isVerifiedOnChain(tokenId: number, achievementId: string): Promise<boolean> {
        try {
            if (!this.contract) return false;

            const identity = await Identity.findOne({ tokenId });
            if (!identity) return false;

            const achievement = identity.profile?.achievements?.find(a => a.id === achievementId);
            if (!achievement || !achievement.verificationHash) return false;

            if ('isAchievementVerified' in this.contract) {
                const isVerified = await (this.contract as any).isAchievementVerified(
                    tokenId,
                    achievement.verificationHash
                );
                return isVerified;
            }

            return false;
        } catch (error) {
            console.error('Error checking verification on-chain:', error);
            return false;
        }
    }

    /**
     * Get verification proof from blockchain
     */
    async getVerificationProof(tokenId: number, achievementId: string): Promise<VerificationProof | null> {
        try {
            if (!this.contract) return null;

            const identity = await Identity.findOne({ tokenId });
            if (!identity) return null;

            const achievement = identity.profile?.achievements?.find(a => a.id === achievementId);
            if (!achievement || !achievement.verificationHash) return null;

            if ('getVerificationProof' in this.contract) {
                const proof = await (this.contract as any).getVerificationProof(
                    tokenId,
                    achievement.verificationHash
                );

                return {
                    achievementId,
                    tokenId,
                    merkleRoot: proof.merkleRoot,
                    merkleProof: proof.merkleProof,
                    timestamp: achievement.dateAchieved.getTime(),
                    txHash: achievement.txHash
                };
            }

            return null;
        } catch (error) {
            console.error('Error getting verification proof:', error);
            return null;
        }
    }

    /**
     * Verify external achievement (from other platforms)
     */
    async verifyExternalAchievement(
        tokenId: number,
        platform: string,
        achievementData: {
            id: string;
            title: string;
            description: string;
            proof: string; // URL or hash of proof
            apiEndpoint?: string; // For API verification
        }
    ): Promise<boolean> {
        try {
            let verificationResult = false;

            switch (platform.toLowerCase()) {
                case 'github':
                    verificationResult = await this.verifyGitHubAchievement(achievementData);
                    break;
                case 'devpost':
                    verificationResult = await this.verifyDevpostAchievement(achievementData);
                    break;
                case 'certifications':
                    verificationResult = await this.verifyCertification(achievementData);
                    break;
                default:
                    verificationResult = await this.verifyGenericAchievement(achievementData);
            }

            if (verificationResult) {
                // Add verified achievement to user's profile
                const identity = await Identity.findOne({ tokenId });
                if (identity) {
                    const achievement = {
                        id: `${platform}_${achievementData.id}`,
                        title: achievementData.title,
                        description: achievementData.description,
                        category: 'external' as any,
                        points: this.calculatePointsForExternal(platform, achievementData),
                        valueImpact: this.calculateValueImpactForExternal(platform, achievementData),
                        dateAchieved: new Date(),
                        verified: true,
                        verificationSource: platform,
                        proof: { type: 'url' as const, value: achievementData.proof }
                    };

                    identity.profile.achievements.push(achievement);
                    identity.achievementCount = identity.profile.achievements.length;
                    identity.reputationScore += achievement.points;
                    identity.currentPrice += achievement.valueImpact;

                    await identity.save();

                    // Verify on blockchain
                    await this.verifyAchievementOnChain(tokenId, achievement.id, {
                        dataHash: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(achievementData))),
                        sourceUrl: achievementData.proof,
                        metadata: { platform, external: true }
                    });
                }
            }

            return verificationResult;
        } catch (error) {
            console.error('Error verifying external achievement:', error);
            return false;
        }
    }

    /**
     * Automated verification system
     */
    async runAutomatedVerification() {
        try {
            // Get all unverified achievements
            const identities = await Identity.find({
                'profile.achievements.verified': false
            });

            for (const identity of identities) {
                const unverifiedAchievements = identity.profile?.achievements?.filter(
                    a => !a.verified && a.proof
                ) || [];

                for (const achievement of unverifiedAchievements) {
                    try {
                        const proofValue = typeof achievement.proof === 'string'
                            ? achievement.proof
                            : achievement.proof?.value;

                        if (proofValue) {
                            const verified = await this.verifyAchievementProof(proofValue);

                            if (verified) {
                                // Update achievement as verified
                                achievement.verified = true;
                                await identity.save();

                                // Verify on blockchain
                                const proofData = typeof achievement.proof === 'string'
                                    ? achievement.proof
                                    : JSON.stringify(achievement.proof);

                                await this.verifyAchievementOnChain(identity.tokenId, achievement.id, {
                                    dataHash: ethers.keccak256(ethers.toUtf8Bytes(proofData)),
                                    sourceUrl: proofValue
                                });

                                console.log(`Auto-verified achievement: ${achievement.title} for ${identity.username}`);
                            }
                        }
                    } catch (error) {
                        console.error(`Error auto-verifying achievement ${achievement.id}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('Error in automated verification:', error);
        }
    }

    /**
     * Generate achievement hash for blockchain storage
     */
    private generateAchievementHash(achievementId: string, proof: any): string {
        const data = {
            achievementId,
            proof: proof.dataHash,
            timestamp: Date.now()
        };

        return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(data)));
    }

    /**
     * Generate merkle proof (simplified version)
     */
    private async generateMerkleProof(tokenId: number, achievementHash: string): Promise<string[]> {
        // In production, implement proper merkle tree generation
        // For now, return a mock proof
        return [
            ethers.keccak256(ethers.toUtf8Bytes(`proof_${tokenId}`)),
            ethers.keccak256(ethers.toUtf8Bytes(`proof_${achievementHash}`))
        ];
    }

    /**
     * Update database with verification details
     */
    private async updateDatabaseVerification(
        tokenId: number,
        achievementId: string,
        verification: {
            txHash: string;
            blockNumber?: number;
            verificationHash: string;
            verified: boolean;
        }
    ) {
        const identity = await Identity.findOne({ tokenId });
        if (!identity) return;

        const achievement = identity.profile?.achievements?.find(a => a.id === achievementId);
        if (achievement) {
            achievement.verified = verification.verified;
            achievement.verificationHash = verification.verificationHash;
            achievement.txHash = verification.txHash;

            await identity.save();
        }
    }

    /**
     * Platform-specific verification methods
     */
    private async verifyGitHubAchievement(achievementData: any): Promise<boolean> {
        try {
            // Verify GitHub contribution, star count, or repository data
            const response = await fetch(achievementData.proof);
            const data = await response.json() as any;

            // Add specific GitHub verification logic here
            return data && data.verified === true;
        } catch (error) {
            return false;
        }
    }

    private async verifyDevpostAchievement(achievementData: any): Promise<boolean> {
        try {
            // Verify Devpost hackathon participation or wins
            const response = await fetch(achievementData.proof);
            const data = await response.json() as any;

            return data && data.status === 'winner';
        } catch (error) {
            return false;
        }
    }

    private async verifyCertification(achievementData: any): Promise<boolean> {
        try {
            // Verify certification from various providers
            const response = await fetch(achievementData.proof);
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    private async verifyGenericAchievement(achievementData: any): Promise<boolean> {
        try {
            // Generic verification for URL-based proofs
            const response = await fetch(achievementData.proof);
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    private async verifyAchievementProof(proof: string): Promise<boolean> {
        try {
            const response = await fetch(proof);
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    private calculatePointsForExternal(platform: string, achievementData: any): number {
        const basePoints = {
            github: 50,
            devpost: 200,
            certifications: 100
        };

        return basePoints[platform as keyof typeof basePoints] || 25;
    }

    private calculateValueImpactForExternal(platform: string, achievementData: any): number {
        const baseImpact = {
            github: 10,
            devpost: 50,
            certifications: 25
        };

        return baseImpact[platform as keyof typeof baseImpact] || 5;
    }

    /**
     * Get verification statistics
     */
    async getVerificationStats() {
        const totalAchievements = await Identity.aggregate([
            { $unwind: '$profile.achievements' },
            { $group: { _id: null, total: { $sum: 1 } } }
        ]);

        const verifiedAchievements = await Identity.aggregate([
            { $unwind: '$profile.achievements' },
            { $match: { 'profile.achievements.verified': true } },
            { $group: { _id: null, total: { $sum: 1 } } }
        ]);

        const verificationRate = totalAchievements[0] && verifiedAchievements[0]
            ? (verifiedAchievements[0].total / totalAchievements[0].total) * 100
            : 0;

        return {
            totalAchievements: totalAchievements[0]?.total || 0,
            verifiedAchievements: verifiedAchievements[0]?.total || 0,
            verificationRate: Math.round(verificationRate * 100) / 100,
            pendingVerifications: (totalAchievements[0]?.total || 0) - (verifiedAchievements[0]?.total || 0)
        };
    }
}

export default VerificationService;