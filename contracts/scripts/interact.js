const hre = require("hardhat");

async function main() {
    const contractAddress = process.env.CONTRACT_ADDRESS || "0x..."; // Replace with deployed address

    console.log("🔗 Interacting with SomniaID contract at:", contractAddress);

    // Get contract instance
    const SomniaID = await hre.ethers.getContractFactory("SomniaID");
    const somniaID = SomniaID.attach(contractAddress);

    // Get signer
    const [signer] = await hre.ethers.getSigners();
    console.log("👤 Using account:", signer.address);

    try {
        // Example interactions
        console.log("\n📋 Available functions:");
        console.log("1. Create Identity");
        console.log("2. Update Reputation");
        console.log("3. Add Achievement");
        console.log("4. Get Identity");
        console.log("5. Get Achievements");

        // Example: Create identity
        console.log("\n🆔 Creating test identity...");
        const createTx = await somniaID.createIdentity("TestUser", "Smart Contract Development");
        await createTx.wait();
        console.log("✅ Identity created! Transaction:", createTx.hash);

        // Example: Get identity
        console.log("\n📊 Getting identity data...");
        const identity = await somniaID.getIdentity(0);
        console.log("Identity:", {
            reputationScore: identity.reputationScore.toString(),
            skillLevel: identity.skillLevel.toString(),
            achievementCount: identity.achievementCount.toString(),
            primarySkill: identity.primarySkill,
            isVerified: identity.isVerified
        });

        // Example: Add achievement
        console.log("\n🏆 Adding achievement...");
        const achievementTx = await somniaID.addAchievement(
            0,
            "First Contract",
            "Deployed first smart contract",
            50
        );
        await achievementTx.wait();
        console.log("✅ Achievement added! Transaction:", achievementTx.hash);

        // Example: Get achievements
        console.log("\n🎯 Getting achievements...");
        const achievements = await somniaID.getAchievements(0);
        console.log("Achievements:", achievements.map(ach => ({
            title: ach.title,
            description: ach.description,
            points: ach.points.toString(),
            timestamp: new Date(ach.timestamp.toNumber() * 1000).toISOString()
        })));

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});