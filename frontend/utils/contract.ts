export const CONTRACT_ABI = [
    {
        "inputs": [
            { "name": "_username", "type": "string" },
            { "name": "_primarySkill", "type": "string" }
        ],
        "name": "createIdentity",
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "name": "tokenId", "type": "uint256" }],
        "name": "getIdentity",
        "outputs": [
            { "name": "username", "type": "string" },
            { "name": "primarySkill", "type": "string" },
            { "name": "reputationScore", "type": "uint256" },
            { "name": "skillLevel", "type": "uint256" },
            { "name": "achievementCount", "type": "uint256" },
            { "name": "isVerified", "type": "bool" },
            { "name": "lastUpdate", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "name": "tokenId", "type": "uint256" },
            { "name": "points", "type": "uint256" }
        ],
        "name": "addReputation",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const