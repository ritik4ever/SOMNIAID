import { ethers } from 'ethers';

export class BlockchainService {
    private provider: ethers.JsonRpcProvider;
    private contract: ethers.Contract | null = null;
    private contractAddress: string | null = null;

    constructor() {
        // DEBUG: Log all environment variables related to blockchain
        console.log('🔍 DEBUG Environment Variables:');
        console.log('CONTRACT_ADDRESS:', process.env.CONTRACT_ADDRESS);
        console.log('RPC_URL:', process.env.RPC_URL);
        console.log('NODE_ENV:', process.env.NODE_ENV);

        this.provider = new ethers.JsonRpcProvider(
            process.env.RPC_URL || 'https://dream-rpc.somnia.network/'
        );

        // Get contract address from environment
        this.contractAddress = process.env.CONTRACT_ADDRESS || null;

        console.log('🔍 Parsed CONTRACT_ADDRESS:', this.contractAddress);

        if (this.contractAddress && this.contractAddress.trim() !== '') {
            const contractABI = [
                'function getIdentity(uint256) view returns (tuple(uint256,uint256,uint256,uint256,string,bool))',
                'function getAchievements(uint256) view returns (tuple(string,string,uint256,uint256)[])',
                'function createIdentity(string,string) public',
                'function updateReputation(uint256,uint256,string) public',
                'function addAchievement(uint256,string,string,uint256) public',
                'event IdentityCreated(uint256 indexed tokenId, address indexed owner, string username)',
                'event ReputationUpdated(uint256 indexed tokenId, uint256 newScore, uint256 timestamp)',
                'event AchievementUnlocked(uint256 indexed tokenId, string title, uint256 points)'
            ];

            try {
                this.contract = new ethers.Contract(
                    this.contractAddress,
                    contractABI,
                    this.provider
                );
                console.log('✅ Blockchain service initialized with contract:', this.contractAddress);
            } catch (error) {
                console.warn('⚠️ Failed to initialize contract:', error);
                this.contract = null;
            }
        } else {
            console.warn('⚠️ No CONTRACT_ADDRESS found in environment variables. Blockchain features will be disabled.');
            console.log('🔍 Current value:', `"${this.contractAddress}"`);
        }
    }

    // ... rest of the methods remain the same
    private ensureContract(): ethers.Contract {
        if (!this.contract) {
            throw new Error('Contract not initialized. Please set CONTRACT_ADDRESS environment variable.');
        }
        return this.contract;
    }

    async getIdentity(tokenId: number) {
        try {
            const contract = this.ensureContract();
            const identity = await contract.getIdentity(tokenId);
            return {
                reputationScore: identity[0].toString(),
                skillLevel: identity[1].toString(),
                achievementCount: identity[2].toString(),
                lastUpdate: identity[3].toString(),
                primarySkill: identity[4],
                isVerified: identity[5]
            };
        } catch (error) {
            console.error('Error fetching identity:', error);
            throw new Error('Failed to fetch identity from blockchain');
        }
    }

    async getAchievements(tokenId: number) {
        try {
            const contract = this.ensureContract();
            const achievements = await contract.getAchievements(tokenId);
            return achievements.map((ach: any) => ({
                title: ach[0],
                description: ach[1],
                timestamp: ach[2].toString(),
                points: ach[3].toString()
            }));
        } catch (error) {
            console.error('Error fetching achievements:', error);
            throw new Error('Failed to fetch achievements from blockchain');
        }
    }

    async verifyTransaction(transactionHash: string) {
        try {
            const receipt = await this.provider.getTransactionReceipt(transactionHash);
            return receipt && receipt.status === 1;
        } catch (error) {
            console.error('Error verifying transaction:', error);
            return false;
        }
    }

    async getLatestBlock() {
        try {
            return await this.provider.getBlockNumber();
        } catch (error) {
            console.error('Error getting latest block:', error);
            return null;
        }
    }

    async estimateGas(method: string, params: any[]) {
        try {
            const contract = this.ensureContract();
            return await contract[method].estimateGas(...params);
        } catch (error) {
            console.error('Error estimating gas:', error);
            throw new Error('Failed to estimate gas');
        }
    }

    isAvailable(): boolean {
        return this.contract !== null;
    }

    getContractAddress(): string | null {
        return this.contractAddress;
    }
}

export const blockchainService = new BlockchainService();