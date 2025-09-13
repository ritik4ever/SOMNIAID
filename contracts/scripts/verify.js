const hre = require("hardhat");

async function main() {
    const contractAddress = process.env.CONTRACT_ADDRESS;

    if (!contractAddress) {
        console.error("❌ Please set CONTRACT_ADDRESS in environment variables");
        process.exit(1);
    }

    console.log("🔍 Verifying SomniaID contract at:", contractAddress);

    try {
        await hre.run("verify:verify", {
            address: contractAddress,
            constructorArguments: [],
            contract: "contracts/SomniaID.sol:SomniaID"
        });

        console.log("✅ Contract verified successfully!");
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log("✅ Contract is already verified!");
        } else {
            console.error("❌ Verification failed:", error.message);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});