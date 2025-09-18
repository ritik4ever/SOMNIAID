// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract SomniaID is ERC721, ERC721URIStorage, Ownable {
    using Strings for uint256;
    
    uint256 private _tokenIdCounter;

    struct Identity {
        uint256 reputationScore;
        uint256 skillLevel;
        uint256 achievementCount;
        uint256 lastUpdate;
        string primarySkill;
        bool isVerified;
        uint256 basePrice;
        uint256 currentPrice;
    }

    struct Achievement {
        string title;
        string description;
        uint256 timestamp;
        uint256 points;
        uint256 priceImpact;
    }

    struct Goal {
        string title;
        string description;
        uint256 deadline;
        uint256 targetValue;
        uint256 currentValue;
        bool completed;
        bool failed;
        uint256 rewardPoints;
        uint256 priceBonus;
    }

    mapping(uint256 => Identity) public identities;
    mapping(uint256 => Achievement[]) public achievements;
    mapping(uint256 => Goal[]) public goals;
    mapping(address => uint256) public addressToTokenId;
    mapping(string => bool) public usedUsernames;
    mapping(uint256 => uint256) public identityPrices;
    mapping(uint256 => bool) public isListed;

    event IdentityCreated(uint256 indexed tokenId, address indexed owner, string username);
    event ReputationUpdated(uint256 indexed tokenId, uint256 newScore);
    event AchievementUnlocked(uint256 indexed tokenId, string title, uint256 points);
    event GoalCompleted(uint256 indexed tokenId, uint256 goalIndex);
    event PriceUpdated(uint256 indexed tokenId, uint256 newPrice);
    event IdentityListed(uint256 indexed tokenId, uint256 price);
    event IdentityPurchased(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price);

    constructor() ERC721("SomniaID Enhanced", "SIDE") Ownable(msg.sender) {}

    function _exists(uint256 tokenId) internal view returns (bool) {
        try this.ownerOf(tokenId) returns (address) {
            return true;
        } catch {
            return false;
        }
    }

    function createIdentity(string calldata username, string calldata skill, uint256 price) external {
        require(bytes(username).length > 0 && bytes(username).length <= 20);
        require(!usedUsernames[username]);
        require(addressToTokenId[msg.sender] == 0);
        require(price >= 0.001 ether);

        uint256 tokenId = _tokenIdCounter++;
        _safeMint(msg.sender, tokenId);
        
        identities[tokenId] = Identity({
            reputationScore: 100,
            skillLevel: 1,
            achievementCount: 0,
            lastUpdate: block.timestamp,
            primarySkill: skill,
            isVerified: false,
            basePrice: price,
            currentPrice: price
        });

        addressToTokenId[msg.sender] = tokenId + 1;
        usedUsernames[username] = true;
        _updateTokenURI(tokenId);
        
        emit IdentityCreated(tokenId, msg.sender, username);
    }

    function addAchievement(uint256 tokenId, string calldata title, string calldata desc, uint256 points, uint256 impact) external {
        require(_exists(tokenId));
        require(msg.sender == ownerOf(tokenId) || msg.sender == owner());

        achievements[tokenId].push(Achievement({
            title: title,
            description: desc,
            timestamp: block.timestamp,
            points: points,
            priceImpact: impact
        }));

        _updateIdentity(tokenId, points, impact);
        emit AchievementUnlocked(tokenId, title, points);
    }

    function setGoal(uint256 tokenId, string calldata title, string calldata desc, uint256 deadline, uint256 target, uint256 reward, uint256 bonus) external {
        require(_exists(tokenId));
        require(msg.sender == ownerOf(tokenId));
        require(deadline > block.timestamp);

        goals[tokenId].push(Goal({
            title: title,
            description: desc,
            deadline: deadline,
            targetValue: target,
            currentValue: 0,
            completed: false,
            failed: false,
            rewardPoints: reward,
            priceBonus: bonus
        }));
    }

    function updateGoalProgress(uint256 tokenId, uint256 goalIndex, uint256 value) external {
        require(_exists(tokenId));
        require(msg.sender == ownerOf(tokenId));
        require(goalIndex < goals[tokenId].length);
        
        Goal storage goal = goals[tokenId][goalIndex];
        require(!goal.completed && !goal.failed);
        require(block.timestamp <= goal.deadline);

        goal.currentValue = value;
        if (value >= goal.targetValue) {
            goal.completed = true;
            _updateIdentity(tokenId, goal.rewardPoints, goal.priceBonus);
            emit GoalCompleted(tokenId, goalIndex);
        }
    }

    function _updateIdentity(uint256 tokenId, uint256 points, uint256 priceImpact) internal {
        Identity storage identity = identities[tokenId];
        identity.reputationScore += points;
        identity.lastUpdate = block.timestamp;
        identity.achievementCount++;

        uint256 newLevel = (identity.reputationScore / 100);
        if (newLevel < 1) newLevel = 1;
        identity.skillLevel = newLevel;

        if (priceImpact > 0) {
            identity.currentPrice = identity.currentPrice + (identity.currentPrice * priceImpact / 10000);
        }

        _updateTokenURI(tokenId);
        emit ReputationUpdated(tokenId, identity.reputationScore);
        emit PriceUpdated(tokenId, identity.currentPrice);
    }

    function listIdentity(uint256 tokenId, uint256 price) external {
        require(_exists(tokenId));
        require(ownerOf(tokenId) == msg.sender);
        require(!isListed[tokenId]);
        require(price > 0);
        
        identityPrices[tokenId] = price;
        isListed[tokenId] = true;
        emit IdentityListed(tokenId, price);
    }

    function buyIdentity(uint256 tokenId) external payable {
        require(_exists(tokenId));
        require(isListed[tokenId]);
        require(msg.value >= identityPrices[tokenId]);
        
        address seller = ownerOf(tokenId);
        require(seller != msg.sender);
        
        uint256 price = identityPrices[tokenId];
        isListed[tokenId] = false;
        identityPrices[tokenId] = 0;
        
        // Transfer payment (98% to seller, 2% fee)
        uint256 sellerAmount = price * 98 / 100;
        payable(seller).transfer(sellerAmount);
        
        // Update mappings
        addressToTokenId[seller] = 0;
        addressToTokenId[msg.sender] = tokenId + 1;
        
        _transfer(seller, msg.sender, tokenId);
        
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
        
        emit IdentityPurchased(tokenId, msg.sender, seller, price);
    }

    function cancelListing(uint256 tokenId) external {
        require(_exists(tokenId));
        require(ownerOf(tokenId) == msg.sender);
        require(isListed[tokenId]);
        
        isListed[tokenId] = false;
        identityPrices[tokenId] = 0;
    }

    // View functions
    function getIdentity(uint256 tokenId) external view returns (Identity memory) {
        require(_exists(tokenId));
        return identities[tokenId];
    }

    function getAchievements(uint256 tokenId) external view returns (Achievement[] memory) {
        require(_exists(tokenId));
        return achievements[tokenId];
    }

    function getGoals(uint256 tokenId) external view returns (Goal[] memory) {
        require(_exists(tokenId));
        return goals[tokenId];
    }

    function getTokenIdByAddress(address addr) external view returns (uint256) {
        uint256 stored = addressToTokenId[addr];
        return stored > 0 ? stored - 1 : 0;
    }

    function hasIdentity(address addr) external view returns (bool) {
        return addressToTokenId[addr] > 0;
    }

    function getListingInfo(uint256 tokenId) external view returns (bool listed, uint256 price) {
        require(_exists(tokenId));
        return (isListed[tokenId], identityPrices[tokenId]);
    }

    function getTotalIdentities() external view returns (uint256) {
        return _tokenIdCounter;
    }

    function _updateTokenURI(uint256 tokenId) internal {
        Identity memory identity = identities[tokenId];
        
        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{"name":"SomniaID #', tokenId.toString(), '",',
            '"description":"Dynamic reputation NFT",',
            '"attributes":[',
            '{"trait_type":"Reputation","value":', identity.reputationScore.toString(), '},',
            '{"trait_type":"Level","value":', identity.skillLevel.toString(), '},',
            '{"trait_type":"Price","value":"', identity.currentPrice.toString(), '"}',
            ']}'
        ))));
        
        _setTokenURI(tokenId, string(abi.encodePacked("data:application/json;base64,", json)));
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function verifyIdentity(uint256 tokenId) external onlyOwner {
        require(_exists(tokenId));
        identities[tokenId].isVerified = true;
        _updateTokenURI(tokenId);
    }

    function withdrawFees() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}