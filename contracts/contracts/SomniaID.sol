// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title SomniaID
 * @dev Dynamic reputation NFTs that evolve in real-time
 */
contract SomniaID is ERC721, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    using Strings for uint256;
    
    Counters.Counter private _tokenIdCounter;

    struct Identity {
        uint256 reputationScore;
        uint256 skillLevel;
        uint256 achievementCount;
        uint256 lastUpdate;
        string primarySkill;
        bool isVerified;
    }

    struct Achievement {
        string title;
        string description;
        uint256 timestamp;
        uint256 points;
    }

    mapping(uint256 => Identity) public identities;
    mapping(uint256 => Achievement[]) public achievements;
    mapping(address => uint256) public addressToTokenId;
    mapping(string => bool) public usedUsernames;

    // Events
    event IdentityCreated(uint256 indexed tokenId, address indexed owner, string username);
    event ReputationUpdated(uint256 indexed tokenId, uint256 newScore, uint256 timestamp);
    event AchievementUnlocked(uint256 indexed tokenId, string title, uint256 points);
    event SkillLevelUp(uint256 indexed tokenId, uint256 newLevel, string skill);

    constructor() ERC721("SomniaID", "SID") {}

    /**
     * @dev Creates a new identity NFT
     */
    function createIdentity(string memory username, string memory initialSkill) public {
        require(bytes(username).length > 0, "Username cannot be empty");
        require(bytes(username).length <= 20, "Username too long");
        require(bytes(initialSkill).length > 0, "Initial skill cannot be empty");
        require(!usedUsernames[username], "Username already taken");
        require(addressToTokenId[msg.sender] == 0, "Identity already exists");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        _safeMint(msg.sender, tokenId);
        
        identities[tokenId] = Identity({
            reputationScore: 100,
            skillLevel: 1,
            achievementCount: 0,
            lastUpdate: block.timestamp,
            primarySkill: initialSkill,
            isVerified: false
        });

        // FIXED: Properly set the addressToTokenId mapping (tokenId + 1 to avoid 0)
        addressToTokenId[msg.sender] = tokenId + 1;
        usedUsernames[username] = true;

        _setTokenURI(tokenId, _generateTokenURI(tokenId));
        
        emit IdentityCreated(tokenId, msg.sender, username);
    }

    /**
     * @dev Updates reputation score of an identity
     * @param tokenId Token ID of the identity
     * @param points Points to add to reputation  
     * @param reason Reason parameter (unused but kept in interface)
     */
    function updateReputation(uint256 tokenId, uint256 points, string memory reason) public {
        require(_exists(tokenId), "Identity does not exist");
        require(
            msg.sender == ownerOf(tokenId) || msg.sender == owner(), 
            "Not authorized to update reputation"
        );
        require(block.timestamp >= identities[tokenId].lastUpdate + 1, "Too frequent updates");

        Identity storage identity = identities[tokenId];
        uint256 oldLevel = identity.skillLevel;
        
        identity.reputationScore += points;
        identity.lastUpdate = block.timestamp;

        // FIXED: Level up logic - level 2 starts at 200, level 3 at 300, etc.
        uint256 newLevel = (identity.reputationScore / 100);
        if (newLevel < 1) newLevel = 1; // Minimum level is 1
        
        if (newLevel > oldLevel) {
            identity.skillLevel = newLevel;
            emit SkillLevelUp(tokenId, newLevel, identity.primarySkill);
        }

        _setTokenURI(tokenId, _generateTokenURI(tokenId));
        emit ReputationUpdated(tokenId, identity.reputationScore, block.timestamp);
        
        // Acknowledge the reason parameter to avoid unused warning
        bytes(reason); // This line prevents unused parameter warning
    }

    /**
     * @dev Adds an achievement to an identity
     */
    function addAchievement(
        uint256 tokenId,
        string memory title,
        string memory description,
        uint256 points
    ) public {
        require(_exists(tokenId), "Identity does not exist");
        require(
            msg.sender == ownerOf(tokenId) || msg.sender == owner(), 
            "Not authorized to add achievement"
        );
        require(bytes(title).length > 0, "Achievement title cannot be empty");
        require(points > 0, "Points must be greater than 0");

        Achievement memory newAchievement = Achievement({
            title: title,
            description: description,
            timestamp: block.timestamp,
            points: points
        });

        achievements[tokenId].push(newAchievement);
        identities[tokenId].achievementCount++;
        
        // Update reputation with achievement points
        updateReputation(tokenId, points, "Achievement unlocked");
        emit AchievementUnlocked(tokenId, title, points);
    }

    /**
     * @dev Generates basic metadata attributes (optimized to reduce stack depth)
     */
    function _generateAttributes(Identity memory identity) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '[',
                '{"trait_type":"Reputation Score","value":', identity.reputationScore.toString(), '},',
                '{"trait_type":"Skill Level","value":', identity.skillLevel.toString(), '},',
                '{"trait_type":"Achievements","value":', identity.achievementCount.toString(), '},',
                '{"trait_type":"Primary Skill","value":"', identity.primarySkill, '"},',
                '{"trait_type":"Verified","value":', identity.isVerified ? 'true' : 'false', '},',
                '{"trait_type":"Last Update","value":', identity.lastUpdate.toString(), '}',
            ']'
        ));
    }

    /**
     * @dev Generates metadata JSON (split to avoid stack depth issues)
     */
    function _generateMetadata(uint256 tokenId, string memory attributes) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '{"name":"SomniaID #', tokenId.toString(), '",',
            '"description":"Dynamic reputation NFT on Somnia Network that evolves in real-time",',
            '"attributes":', attributes, ',',
            '"image":"https://api.somniaID.com/avatar/', tokenId.toString(), '.png"',
            '}'
        ));
    }

    /**
     * @dev Generates dynamic token URI (optimized to avoid stack depth issues)
     */
    function _generateTokenURI(uint256 tokenId) internal view returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        
        Identity memory identity = identities[tokenId];
        
        // Generate attributes in separate function to reduce stack depth
        string memory attributes = _generateAttributes(identity);
        
        // Generate metadata in separate function
        string memory metadata = _generateMetadata(tokenId, attributes);
        
        // Encode to base64
        string memory json = Base64.encode(bytes(metadata));
        
        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    /**
     * @dev Gets identity data by token ID
     */
    function getIdentity(uint256 tokenId) public view returns (Identity memory) {
        require(_exists(tokenId), "Identity does not exist");
        return identities[tokenId];
    }

    /**
     * @dev Gets all achievements by token ID
     */
    function getAchievements(uint256 tokenId) public view returns (Achievement[] memory) {
        require(_exists(tokenId), "Identity does not exist");
        return achievements[tokenId];
    }

    /**
     * @dev Gets total number of identities created
     */
    function getTotalIdentities() public view returns (uint256) {
        return _tokenIdCounter.current();
    }

    /**
     * @dev Gets token ID by address (returns 0 if no identity exists)
     */
    function getTokenIdByAddress(address addr) public view returns (uint256) {
        uint256 storedValue = addressToTokenId[addr];
        return storedValue > 0 ? storedValue - 1 : 0;
    }

    /**
     * @dev Checks if address has an identity
     */
    function hasIdentity(address addr) public view returns (bool) {
        return addressToTokenId[addr] > 0;
    }

    /**
     * @dev Verifies an identity (owner only)
     */
    function verifyIdentity(uint256 tokenId) public onlyOwner {
        require(_exists(tokenId), "Identity does not exist");
        identities[tokenId].isVerified = true;
        _setTokenURI(tokenId, _generateTokenURI(tokenId));
    }

    // Override functions required by inheritance
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
}