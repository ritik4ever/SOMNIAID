import mongoose from 'mongoose';
import dotenv from 'dotenv';
import BlockchainSyncService from '../src/services/blockchain-sync';
import Identity from '../src/models/Identity';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/somniaID';

async function connectToDatabase() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        process.exit(1);
    }
}

async function validateEnvironment() {
    console.log('🔍 Validating environment configuration...');

    const contractAddress = process.env.CONTRACT_ADDRESS;

    if (!contractAddress) {
        console.error('❌ CONTRACT_ADDRESS environment variable not set!');
        console.error('   Add CONTRACT_ADDRESS=0xYOUR_ACTUAL_ADDRESS to your .env file');
        return false;
    }

    if (contractAddress === '0x6f2CC3Fb16894A19aa1eA275158F7dd4d345a983') {
        console.error('❌ Still using OLD contract address!');
        console.error('   Current:', contractAddress);
        console.error('   Update with your actual deployed contract address');
        return false;
    }

    console.log('✅ Environment validation passed');
    console.log('   Contract Address:', contractAddress);
    console.log('   MongoDB URI:', MONGODB_URI);

    return true;
}

async function main() {
    console.log('🚀 Starting Enhanced Token ID Sync Script...');
    console.log('================================================');

    // Step 1: Validate environment
    const envValid = await validateEnvironment();
    if (!envValid) {
        console.error('❌ Environment validation failed. Fix your .env file first.');
        process.exit(1);
    }

    // Step 2: Connect to database
    await connectToDatabase();

    try {
        // Step 3: Check blockchain service status
        console.log('\n🔍 CHECKING BLOCKCHAIN SERVICE STATUS:');
        const serviceStatus = BlockchainSyncService.getServiceStatus();

        console.log(`   Config Valid: ${serviceStatus.configValid ? '✅' : '❌'}`);
        console.log(`   Initialized: ${serviceStatus.initialized ? '✅' : '❌'}`);
        console.log(`   Ready: ${serviceStatus.ready ? '✅' : '❌'}`);
        console.log(`   Contract: ${serviceStatus.contractAddress}`);
        console.log(`   RPC: ${serviceStatus.rpcUrl}`);

        if (!serviceStatus.ready) {
            console.error('❌ Blockchain service not ready. Attempting reinitialization...');
            const reinitSuccess = await BlockchainSyncService.reinitialize();

            if (!reinitSuccess) {
                console.error('❌ Failed to initialize blockchain service. Check your configuration.');
                process.exit(1);
            }
        }

        // Step 4: Show current state
        console.log('\n📊 CURRENT DATABASE STATE:');
        const allIdentities = await Identity.find({}).lean();

        console.log(`Total identities in database: ${allIdentities.length}`);

        if (allIdentities.length === 0) {
            console.log('⚠️  No identities found in database.');
            console.log('   This could mean:');
            console.log('   - No identities have been created yet');
            console.log('   - Database connection issues');
            console.log('   - Wrong database name');
        } else {
            console.log('\nCurrent Token IDs:');
            allIdentities.forEach(identity => {
                console.log(`  ${identity.username || 'Unknown'} (${identity.ownerAddress}): Token ID ${identity.tokenId}`);
            });
        }

        // Step 5: Create backup
        console.log('\n💾 CREATING BACKUP...');
        const fs = require('fs');
        const backupPath = `backup-identities-${Date.now()}.json`;
        fs.writeFileSync(backupPath, JSON.stringify(allIdentities, null, 2));
        console.log(`✅ Backup created: ${backupPath}`);

        // Step 6: Test specific address if provided
        const testAddress = '0x0941c361bbe04e739fAB4Fbac2E4b3A72EdC810C'; // Your address
        console.log(`\n🔍 TESTING SPECIFIC ADDRESS: ${testAddress}`);

        try {
            const verification = await BlockchainSyncService.verifyAddressTokenId(testAddress);
            console.log('Verification result:', verification);

            if (!verification.correct && verification.blockchainTokenId) {
                console.log(`🔧 Fixing token ID mismatch for test address...`);
                const fixed = await BlockchainSyncService.fixAddressTokenId(testAddress);
                console.log(`Fix result: ${fixed ? '✅ Success' : '❌ Failed'}`);
            }
        } catch (testError) {
            console.error('❌ Test address verification failed:', testError);
        }

        // Step 7: Run full sync
        console.log('\n🔄 STARTING FULL BLOCKCHAIN SYNC...');
        console.log('This may take a few minutes...');

        await BlockchainSyncService.syncAllIdentities();

        // Step 8: Show results
        console.log('\n📊 POST-SYNC DATABASE STATE:');
        const updatedIdentities = await Identity.find({}).lean();

        console.log('\nUpdated Token IDs:');
        updatedIdentities.forEach(identity => {
            const oldIdentity = allIdentities.find(old => old.ownerAddress === identity.ownerAddress);
            const changed = oldIdentity && oldIdentity.tokenId !== identity.tokenId;

            console.log(`  ${identity.username || 'Unknown'} (${identity.ownerAddress}): Token ID ${identity.tokenId} ${changed ? `(was ${oldIdentity?.tokenId}) ✅ FIXED` : '✅'}`);
        });

        // Step 9: Final verification of critical addresses
        console.log('\n🔍 FINAL VERIFICATION OF KEY ADDRESSES...');
        const keyAddresses = [
            '0x0941c361bbe04e739fAB4Fbac2E4b3A72EdC810C', // Your address
            // Add other important addresses here
        ];

        for (const address of keyAddresses) {
            try {
                const identity = await Identity.findOne({ ownerAddress: address.toLowerCase() });
                if (identity) {
                    const verification = await BlockchainSyncService.verifyAddressTokenId(address);

                    if (verification.correct) {
                        console.log(`✅ ${identity.username} (${address}): Token ID ${verification.blockchainTokenId} - VERIFIED`);
                    } else {
                        console.log(`❌ ${identity.username} (${address}): DB=${verification.dbTokenId}, Blockchain=${verification.blockchainTokenId} - MISMATCH`);
                    }
                } else {
                    console.log(`⚠️  ${address}: No database record found`);
                }
            } catch (verifyError) {
                console.error(`❌ Verification failed for ${address}:`, verifyError);
            }
        }

        // Step 10: Summary and recommendations
        console.log('\n================================================');
        console.log('📋 SYNC SUMMARY & RECOMMENDATIONS:');

        const totalBefore = allIdentities.length;
        const totalAfter = updatedIdentities.length;
        const changes = updatedIdentities.filter(identity => {
            const old = allIdentities.find(o => o.ownerAddress === identity.ownerAddress);
            return old && old.tokenId !== identity.tokenId;
        }).length;

        console.log(`   📊 Total identities: ${totalAfter} (was ${totalBefore})`);
        console.log(`   🔧 Token IDs fixed: ${changes}`);
        console.log(`   💾 Backup saved: ${backupPath}`);

        if (changes === 0) {
            console.log('✅ All token IDs were already correct!');
        } else {
            console.log(`✅ Successfully fixed ${changes} token ID mismatches!`);
        }

        console.log('\n📝 Next Steps:');
        console.log('   1. Test your frontend dashboard - should now show correct data');
        console.log('   2. Try listing an NFT for sale - should work now');
        console.log('   3. Verify "Unknown User" is now showing real usernames');
        console.log('   4. Check that status shows "Verified" instead of "Pending"');

        console.log('\n🚀 Sync script completed successfully!');

    } catch (error: any) {
        console.error('❌ Sync script failed:', error);

        // Provide specific error guidance
        if (error.message?.includes('network')) {
            console.error('   → Network issue: Check your internet connection and RPC_URL');
        } else if (error.message?.includes('contract')) {
            console.error('   → Contract issue: Verify CONTRACT_ADDRESS is correct');
        } else if (error.message?.includes('database')) {
            console.error('   → Database issue: Check MongoDB connection');
        }

        console.error('\n🔍 Debug Information:');
        console.error('   CONTRACT_ADDRESS:', process.env.CONTRACT_ADDRESS);
        console.error('   RPC_URL:', process.env.RPC_URL);
        console.error('   MONGODB_URI:', MONGODB_URI);

        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('📝 Database connection closed');
    }
}

// Run the script
if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Script execution failed:', error);
        process.exit(1);
    });
}

export default main;