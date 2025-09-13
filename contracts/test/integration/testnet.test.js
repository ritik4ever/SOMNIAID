const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('Testnet Integration Tests', function () {
    let somniaID;
    let owner;
    let addr1;
    const SOMNIA_RPC = 'https://dream-rpc.somnia.network/';

    before(async function () {
        // Skip if not on testnet
        if (network.name !== 'somnia') {
            this.skip();
        }

        [owner, addr1] = await ethers.getSigners();

        // Connect to deployed contract or deploy new one
        const contractAddress = process.env.CONTRACT_ADDRESS;
        if (contractAddress) {
            const SomniaID = await ethers.getContractFactory('SomniaID');
            somniaID = SomniaID.attach(contractAddress);
        } else {
            const SomniaID = await ethers.getContractFactory('SomniaID');
            somniaID = await SomniaID.deploy();
            await somniaID.waitForDeployment();
            console.log('Test contract deployed to:', await somniaID.getAddress());
        }
    });

    it('should create identity on testnet', async function () {
        this.timeout(30000); // Longer timeout for network calls

        const username = `testuser_${Date.now()}`;
        const skill = 'Testing';

        const tx = await somniaID.connect(addr1).createIdentity(username, skill);
        const receipt = await tx.wait();

        expect(receipt.status).to.equal(1);

        // Get the tokenId from the event
        const event = receipt.events?.find(e => e.event === 'IdentityCreated');
        const tokenId = event?.args?.[0];

        const identity = await somniaID.getIdentity(tokenId);
        expect(identity.primarySkill).to.equal(skill);
        expect(identity.reputationScore).to.equal(100);
    });

    it('should handle network congestion gracefully', async function () {
        this.timeout(60000);

        const promises = [];
        for (let i = 0; i < 5; i++) {
            promises.push(
                somniaID.connect(addr1).updateReputation(0, 10, `Batch update ${i}`)
                    .catch(err => {
                        // Expected to fail due to rate limiting
                        expect(err.message).to.include('Too frequent updates');
                    })
            );
        }

        await Promise.allSettled(promises);
    });

    it('should verify transaction finality speed', async function () {
        this.timeout(10000);

        const startTime = Date.now();

        const tx = await somniaID.getTotalIdentities();
        await tx.wait();

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should be sub-second on Somnia
        expect(duration).to.be.lessThan(1000);
        console.log(`Transaction finality: ${duration}ms`);
    });
});