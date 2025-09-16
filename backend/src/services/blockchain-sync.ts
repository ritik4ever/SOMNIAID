// backend/src/services/blockchain-sync.ts - VALIDATION FIX
import { ethers } from 'ethers';
import Identity from '../models/Identity';

// Get contract address from environment
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x6f2CC3Fb16894A19aa1eA275158F7dd4d345a983';
const RPC_URL = process.env.RPC_URL || 'https://dream-rpc.somnia.network/';

// FIXED: Enhanced validation without incorrect "old address" check
const validateConfiguration = () => {
    console.log('🔍 Validating blockchain sync configuration...');

    if (!CONTRACT_ADDRESS) {
        console.error('❌ CONTRACT_ADDRESS environment variable not set!');
        console.error('   Add CONTRACT_ADDRESS=0xYOUR_ACTUAL_ADDRESS to your .env file');
        return false;
    }

    // REMOVED: The incorrect "old address" check that was blocking your real contract

    console.log('✅ Contract address validated:', CONTRACT_ADDRESS);
    console.log('✅ RPC URL:', RPC_URL);
    return true;
};

// Comprehensive ABI with all functions we need
const CONTRACT_ABI = [
    // View functions for reading data
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function getIdentity(uint256 tokenId) view returns (tuple(uint256 reputationScore, uint256 skillLevel, uint256 achievementCount, uint256 lastUpdate, string primarySkill, bool isVerified))',
    'function hasIdentity(address owner) view returns (bool)',
    'function getTokenIdByAddress(address owner) view returns (uint256)',
    'function getTotalIdentities() view returns (uint256)',

    // Contract info functions for debugging
    'function name() view returns (string)',
    'function symbol() view returns (string)',

    // Additional functions for comprehensive support
    'function balanceOf(address owner) view returns (uint256)',
    'function tokenURI(uint256 tokenId) view returns (string)',

    // Events for monitoring (useful for future event listening)
    'event IdentityCreated(uint256 indexed tokenId, address indexed owner, string username)',
    'event ReputationUpdated(uint256 indexed tokenId, uint256 newScore, uint256 timestamp)',
    'event AchievementUnlocked(uint256 indexed tokenId, string title, uint256 points)'
];

export class BlockchainSyncService {
    private provider?: ethers.JsonRpcProvider;
    private contract?: ethers.Contract;
    private isInitialized: boolean = false;
    private configValid: boolean = false;

    constructor() {
        // Validate configuration first
        this.configValid = validateConfiguration();

        if (!this.configValid) {
            console.error('❌ BlockchainSyncService initialization failed due to configuration errors');
            return;
        }

        try {
            this.provider = new ethers.JsonRpcProvider(RPC_URL);
            this.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.provider);

            console.log('🔗 Blockchain Sync Service initialized successfully:');
            console.log('   Contract Address:', CONTRACT_ADDRESS);
            console.log('   RPC URL:', RPC_URL);

            // Test connection asynchronously
            this.testConnection().then((success) => {
                this.isInitialized = success;
                if (success) {
                    console.log('✅ Blockchain Sync Service ready');
                } else {
                    console.error('❌ Blockchain Sync Service connection test failed');
                }
            });

        } catch (error) {
            console.error('❌ Failed to initialize Blockchain Sync Service:', error);
        }
    }

    // Test contract connection with comprehensive checks
    private async testConnection(): Promise<boolean> {
        if (!this.configValid || !this.provider || !this.contract) {
            console.error('❌ Cannot test connection: Invalid configuration or missing provider/contract');
            return false;
        }

        try {
            console.log('🔍 Testing blockchain connection...');

            // Test 1: Basic RPC connection
            try {
                const blockNumber = await this.provider.getBlockNumber();
                console.log('✅ RPC connection successful. Latest block:', blockNumber);
            } catch (rpcError) {
                console.error('❌ RPC connection failed:', rpcError);
                return false;
            }

            // Test 2: Contract connection and metadata
            try {
                const name = await this.contract.name();
                const symbol = await this.contract.symbol();
                console.log(`✅ Connected to contract: ${name} (${symbol})`);
                console.log('   Contract address:', CONTRACT_ADDRESS);
            } catch (contractError: any) {
                console.error('❌ Contract connection failed:', contractError);

                if (contractError.message?.includes('call revert exception')) {
                    console.error('   → Contract not found at this address or incompatible ABI');
                    console.error('   → Verify CONTRACT_ADDRESS is correct');
                } else if (contractError.message?.includes('network')) {
                    console.error('   → Network connectivity issue');
                }

                return false;
            }

            // Test 3: Check if contract has expected functions
            try {
                const totalIdentities = await this.contract.getTotalIdentities();
                console.log(`✅ Contract functionality verified. Total identities: ${totalIdentities}`);
            } catch (funcError) {
                console.error('❌ Contract function test failed:', funcError);
                console.error('   → Contract may be incompatible or missing expected functions');
                return false;
            }

            console.log('🎉 All connection tests passed!');
            return true;

        } catch (error) {
            console.error('❌ Connection test failed:', error);
            return false;
        }
    }

    // Check if service is ready to use
    private checkServiceReady(): boolean {
        if (!this.configValid) {
            console.error('❌ Service not ready: Invalid configuration');
            return false;
        }

        if (!this.isInitialized) {
            console.error('❌ Service not ready: Not properly initialized');
            return false;
        }

        if (!this.provider || !this.contract) {
            console.error('❌ Service not ready: Missing provider or contract');
            return false;
        }

        return true;
    }

    // MAIN SYNC FUNCTION - fixes all token ID mismatches with comprehensive error handling
    async syncAllIdentities(): Promise<void> {
        console.log('🔄 Starting complete blockchain sync...');
        console.log('=====================================');

        if (!this.checkServiceReady()) {
            throw new Error('Blockchain sync service not ready. Check configuration.');
        }

        try {
            // Step 1: Get all identities from blockchain
            console.log('Step 1: Fetching all identities from blockchain...');
            const blockchainData = await this.getAllBlockchainIdentities();
            console.log(`📊 Found ${blockchainData.length} identities on blockchain`);

            if (blockchainData.length === 0) {
                console.log('⚠️  No identities found on blockchain. This could mean:');
                console.log('   - No identities have been minted yet');
                console.log('   - Network connection issues');
                return;
            }

            // Step 2: Get all identities from database
            console.log('Step 2: Fetching all identities from database...');
            const dbIdentities = await Identity.find({}).lean();
            console.log(`📊 Found ${dbIdentities.length} identities in database`);

            // Step 3: Create address-to-blockchain mapping
            console.log('Step 3: Creating blockchain mapping...');
            const blockchainByAddress = new Map();

            blockchainData.forEach(identity => {
                blockchainByAddress.set(identity.ownerAddress.toLowerCase(), identity);
            });

            console.log('   ✅ Created blockchain lookup maps');

            // Step 4: Analyze and fix each database identity
            console.log('Step 4: Analyzing database identities...');
            let fixed = 0;
            let errors = 0;
            let unchanged = 0;

            for (const dbIdentity of dbIdentities) {
                try {
                    console.log(`\n🔍 Processing: ${dbIdentity.username} (${dbIdentity.ownerAddress})`);

                    const blockchainIdentity = blockchainByAddress.get(dbIdentity.ownerAddress.toLowerCase());

                    if (!blockchainIdentity) {
                        console.log(`   ⚠️  No blockchain identity found for ${dbIdentity.ownerAddress}`);
                        continue;
                    }

                    // Check if token ID needs fixing
                    if (dbIdentity.tokenId !== blockchainIdentity.tokenId) {
                        console.log(`   🔧 Token ID mismatch detected:`);
                        console.log(`      Database: ${dbIdentity.tokenId} → Blockchain: ${blockchainIdentity.tokenId}`);

                        // Update with correct blockchain data
                        const updateResult = await Identity.updateOne(
                            { _id: dbIdentity._id },
                            {
                                $set: {
                                    tokenId: blockchainIdentity.tokenId,
                                    reputationScore: blockchainIdentity.reputationScore,
                                    skillLevel: blockchainIdentity.skillLevel,
                                    achievementCount: blockchainIdentity.achievementCount,
                                    lastUpdate: blockchainIdentity.lastUpdate,
                                    primarySkill: blockchainIdentity.primarySkill,
                                    isVerified: blockchainIdentity.isVerified,
                                    lastMetadataUpdate: Date.now(),
                                    updatedAt: new Date()
                                }
                            }
                        );

                        if (updateResult.modifiedCount > 0) {
                            fixed++;
                            console.log(`   ✅ Fixed! Now using token ID ${blockchainIdentity.tokenId}`);
                        } else {
                            console.log(`   ⚠️  Update operation returned 0 modified documents`);
                        }
                    } else {
                        unchanged++;
                        console.log(`   ✅ Token ID ${dbIdentity.tokenId} already correct`);
                    }
                } catch (error) {
                    console.error(`   ❌ Error fixing identity ${dbIdentity.ownerAddress}:`, error);
                    errors++;
                }
            }

            // Step 5: Summary
            console.log('\n=====================================');
            console.log('📊 SYNC SUMMARY:');
            console.log(`   ✅ Fixed: ${fixed} identities`);
            console.log(`   ✅ Already correct: ${unchanged} identities`);
            console.log(`   ❌ Errors: ${errors} identities`);

            if (errors === 0 && fixed > 0) {
                console.log('🎉 Sync completed successfully with fixes applied!');
            } else if (errors === 0 && fixed === 0) {
                console.log('✅ All identities were already correctly synced!');
            }

        } catch (error: any) {
            console.error('❌ Blockchain sync failed:', error);
            throw error;
        }
    }

    // Get all identities from blockchain
    private async getAllBlockchainIdentities(): Promise<any[]> {
        console.log('📡 Fetching all identities from blockchain...');

        if (!this.checkServiceReady() || !this.contract) {
            throw new Error('Service not ready for blockchain queries');
        }

        const identities = [];
        let tokenId = 1;
        let consecutiveFailures = 0;
        const maxConsecutiveFailures = 20;

        while (consecutiveFailures < maxConsecutiveFailures) {
            try {
                const owner = await this.contract.ownerOf(tokenId);
                const identityData = await this.contract.getIdentity(tokenId);

                const identity = {
                    tokenId: tokenId,
                    ownerAddress: owner.toLowerCase(),
                    reputationScore: Number(identityData.reputationScore),
                    skillLevel: Number(identityData.skillLevel),
                    achievementCount: Number(identityData.achievementCount),
                    lastUpdate: Number(identityData.lastUpdate),
                    primarySkill: identityData.primarySkill,
                    isVerified: identityData.isVerified
                };

                identities.push(identity);
                console.log(`   📋 Token ID ${tokenId} → Owner: ${owner}`);
                consecutiveFailures = 0;

            } catch (error: any) {
                consecutiveFailures++;
            }

            tokenId++;
        }

        console.log(`✅ Found ${identities.length} total identities`);
        return identities;
    }

    // Verify a specific address has correct token ID
    async verifyAddressTokenId(address: string): Promise<{ correct: boolean, dbTokenId?: number, blockchainTokenId?: number, error?: string }> {
        try {
            if (!this.checkServiceReady() || !this.contract) {
                return {
                    correct: false,
                    error: 'Service not ready: Check configuration'
                };
            }

            const dbIdentity = await Identity.findOne({ ownerAddress: address.toLowerCase() });
            if (!dbIdentity) {
                return {
                    correct: false,
                    error: 'No database identity found'
                };
            }

            const hasIdentity = await this.contract.hasIdentity(address);
            if (!hasIdentity) {
                return {
                    correct: false,
                    dbTokenId: dbIdentity.tokenId,
                    error: 'No blockchain identity found'
                };
            }

            const blockchainTokenId = Number(await this.contract.getTokenIdByAddress(address));
            const isCorrect = dbIdentity.tokenId === blockchainTokenId;

            return {
                correct: isCorrect,
                dbTokenId: dbIdentity.tokenId,
                blockchainTokenId
            };

        } catch (error: any) {
            console.error('❌ Error verifying address token ID:', error);
            return {
                correct: false,
                error: error.message || 'Verification failed'
            };
        }
    }

    // Fix token ID for a specific address
    async fixAddressTokenId(address: string): Promise<boolean> {
        try {
            if (!this.checkServiceReady() || !this.contract) {
                console.error('❌ Cannot fix address: Service not ready');
                return false;
            }

            const hasIdentity = await this.contract.hasIdentity(address);
            if (!hasIdentity) {
                console.log(`❌ No blockchain identity found for ${address}`);
                return false;
            }

            const blockchainTokenId = Number(await this.contract.getTokenIdByAddress(address));
            const identityData = await this.contract.getIdentity(blockchainTokenId);

            const result = await Identity.updateOne(
                { ownerAddress: address.toLowerCase() },
                {
                    $set: {
                        tokenId: blockchainTokenId,
                        reputationScore: Number(identityData.reputationScore),
                        skillLevel: Number(identityData.skillLevel),
                        achievementCount: Number(identityData.achievementCount),
                        lastUpdate: Number(identityData.lastUpdate),
                        primarySkill: identityData.primarySkill,
                        isVerified: identityData.isVerified,
                        lastMetadataUpdate: Date.now(),
                        updatedAt: new Date()
                    }
                }
            );

            return result.modifiedCount > 0 || result.matchedCount > 0;

        } catch (error: any) {
            console.error(`❌ Error fixing token ID for ${address}:`, error);
            return false;
        }
    }

    // Get blockchain identity for an address (used by API)
    async getBlockchainIdentity(address: string): Promise<any | null> {
        try {
            if (!this.checkServiceReady() || !this.contract) {
                return null;
            }

            const hasIdentity = await this.contract.hasIdentity(address);
            if (!hasIdentity) {
                return null;
            }

            const tokenId = Number(await this.contract.getTokenIdByAddress(address));
            const owner = await this.contract.ownerOf(tokenId);
            const identityData = await this.contract.getIdentity(tokenId);

            return {
                tokenId,
                ownerAddress: owner.toLowerCase(),
                reputationScore: Number(identityData.reputationScore),
                skillLevel: Number(identityData.skillLevel),
                achievementCount: Number(identityData.achievementCount),
                lastUpdate: Number(identityData.lastUpdate),
                primarySkill: identityData.primarySkill,
                isVerified: identityData.isVerified,
                source: 'blockchain',
                synced: true
            };

        } catch (error: any) {
            console.error('❌ Error getting blockchain identity:', error);
            return null;
        }
    }

    // Utility function to get service status
    getServiceStatus() {
        return {
            configValid: this.configValid,
            initialized: this.isInitialized,
            ready: this.checkServiceReady(),
            contractAddress: CONTRACT_ADDRESS,
            rpcUrl: RPC_URL,
            hasProvider: !!this.provider,
            hasContract: !!this.contract
        };
    }

    // Manual force re-initialization
    async reinitialize() {
        console.log('🔄 Force reinitializing Blockchain Sync Service...');

        this.configValid = validateConfiguration();

        if (!this.configValid) {
            return false;
        }

        try {
            this.provider = new ethers.JsonRpcProvider(RPC_URL);
            this.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.provider);

            const connectionSuccess = await this.testConnection();
            this.isInitialized = connectionSuccess;

            return connectionSuccess;
        } catch (error) {
            console.error('❌ Reinitialization error:', error);
            return false;
        }
    }
}

export default new BlockchainSyncService();