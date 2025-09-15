require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

module.exports = {
    solidity: {
        version: "0.8.19",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            },
            viaIR: true // This fixes the stack too deep error
        }
    },
    networks: {
        somnia: {
            url: process.env.SOMNIA_RPC_URL || "https://dream-rpc.somnia.network/",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 50312,
            gas: 2100000,
            gasPrice: 8000000000
        },
        localhost: {
            url: "http://127.0.0.1:8545"
        }
    },
    etherscan: {
        apiKey: {
            somnia: "no-api-key-needed" // Placeholder for custom networks
        },
        customChains: [
            {
                network: "somnia",
                chainId: 50312,
                urls: {
                    apiURL: "https://shannon-explorer.somnia.network/api",
                    browserURL: "https://shannon-explorer.somnia.network"
                }
            }
        ]
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS !== undefined,
        currency: "USD"
    }
};