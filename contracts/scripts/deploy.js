const hre = require("hardhat");

async function main() {
    console.log("🚀 Deploying SomniaID contract to Somnia Network...");

    // Deploy the optimized version
    const SomniaID = await hre.ethers.getContractFactory("SomniaID");

    console.log("📋 Deploying with optimizer enabled and viaIR...");

    const somniaID = await SomniaID.deploy();
    await somniaID.waitForDeployment();

    const contractAddress = await somniaID.getAddress();

    console.log("✅ SomniaID deployed to:", contractAddress);
    console.log("🔗 Transaction hash:", somniaID.deploymentTransaction().hash);
    console.log("🌐 Explorer:", `https://shannon-explorer.somnia.network/address/${contractAddress}`);

    // Save the address for frontend
    const fs = require('fs');
    fs.writeFileSync('.deployed_address', contractAddress);

    // Verify contract after deployment
    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
        console.log("⏳ Waiting for block confirmations...");
        await somniaID.deploymentTransaction().wait(6);

        try {
            await hre.run("verify:verify", {
                address: contractAddress,
                constructorArguments: [],
            });
            console.log("✅ Contract verified successfully!");
        } catch (error) {
            console.log("⚠️ Verification failed:", error.message);
        }
    }

    // Test the deployment
    console.log("🧪 Testing deployed contract...");
    try {
        const totalIdentities = await somniaID.getTotalIdentities();
        console.log("📊 Total identities:", totalIdentities.toString());
        console.log("✅ Contract is working correctly!");
    } catch (error) {
        console.log("❌ Contract test failed:", error.message);
    }
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exitCode = 1;
});