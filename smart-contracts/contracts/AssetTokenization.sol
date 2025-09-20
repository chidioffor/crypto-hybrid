// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title TokenizedAsset
 * @dev ERC20 token representing a tokenized real-world asset
 */
contract TokenizedAsset is ERC20, ERC20Burnable, Ownable, Pausable, ERC20Permit {
    struct AssetMetadata {
        string assetType; // e.g., "real_estate", "precious_metals", "art"
        string description;
        string location;
        uint256 totalValue; // Total asset value in USD (with decimals)
        string documentHash; // IPFS hash of legal documents
        address custodian; // Entity responsible for physical asset
        uint256 creationDate;
        bool isActive;
    }

    AssetMetadata public metadata;
    mapping(address => bool) public authorizedMinters;
    mapping(address => bool) public authorizedBurners;
    
    // Trading restrictions
    bool public tradingEnabled = true;
    mapping(address => bool) public blacklistedAddresses;
    
    // Dividend/yield distribution
    uint256 public totalDividendsDistributed;
    mapping(address => uint256) public lastDividendPoints;
    uint256 public dividendPointsPerShare;
    uint256 public constant DIVIDEND_POINTS_ACCURACY = 10**18;

    // Events
    event AssetMetadataUpdated(string field, string oldValue, string newValue);
    event TradingStatusChanged(bool enabled);
    event DividendDistributed(uint256 amount, uint256 perShare);
    event DividendClaimed(address indexed holder, uint256 amount);
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event BurnerAdded(address indexed burner);
    event BurnerRemoved(address indexed burner);

    modifier onlyAuthorizedMinter() {
        require(authorizedMinters[msg.sender] || msg.sender == owner(), "Not authorized to mint");
        _;
    }

    modifier onlyAuthorizedBurner() {
        require(authorizedBurners[msg.sender] || msg.sender == owner(), "Not authorized to burn");
        _;
    }

    modifier notBlacklisted(address account) {
        require(!blacklistedAddresses[account], "Address is blacklisted");
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _totalSupply,
        address _owner,
        AssetMetadata memory _metadata
    ) ERC20(_name, _symbol) ERC20Permit(_name) {
        require(_totalSupply > 0, "Total supply must be greater than 0");
        require(_owner != address(0), "Invalid owner address");
        require(bytes(_metadata.assetType).length > 0, "Asset type required");
        require(_metadata.totalValue > 0, "Asset value must be greater than 0");

        metadata = _metadata;
        metadata.creationDate = block.timestamp;
        metadata.isActive = true;

        _mint(_owner, _totalSupply);
        _transferOwnership(_owner);
    }

    /**
     * @dev Mint new tokens (authorized minters only)
     */
    function mint(address to, uint256 amount) public onlyAuthorizedMinter whenNotPaused {
        _mint(to, amount);
    }

    /**
     * @dev Burn tokens (authorized burners only)
     */
    function burnFrom(address account, uint256 amount) public override onlyAuthorizedBurner {
        super.burnFrom(account, amount);
    }

    /**
     * @dev Transfer tokens with restrictions
     */
    function transfer(address to, uint256 amount) 
        public 
        override 
        whenNotPaused 
        notBlacklisted(msg.sender) 
        notBlacklisted(to) 
        returns (bool) 
    {
        require(tradingEnabled, "Trading is disabled");
        _updateDividendPoints(msg.sender);
        _updateDividendPoints(to);
        return super.transfer(to, amount);
    }

    /**
     * @dev Transfer from with restrictions
     */
    function transferFrom(address from, address to, uint256 amount) 
        public 
        override 
        whenNotPaused 
        notBlacklisted(from) 
        notBlacklisted(to) 
        returns (bool) 
    {
        require(tradingEnabled, "Trading is disabled");
        _updateDividendPoints(from);
        _updateDividendPoints(to);
        return super.transferFrom(from, to, amount);
    }

    /**
     * @dev Distribute dividends to token holders
     */
    function distributeDividends() external payable onlyOwner {
        require(msg.value > 0, "No dividends to distribute");
        require(totalSupply() > 0, "No tokens in circulation");

        uint256 dividendPerShare = (msg.value * DIVIDEND_POINTS_ACCURACY) / totalSupply();
        dividendPointsPerShare += dividendPerShare;
        totalDividendsDistributed += msg.value;

        emit DividendDistributed(msg.value, dividendPerShare);
    }

    /**
     * @dev Claim pending dividends
     */
    function claimDividends() external {
        _updateDividendPoints(msg.sender);
        // Dividend claiming logic would be implemented here
        // This is a simplified version
    }

    /**
     * @dev Update dividend points for an account
     */
    function _updateDividendPoints(address account) internal {
        uint256 owedDividends = _getOwedDividends(account);
        if (owedDividends > 0) {
            // Transfer dividends (simplified - in practice would use a more complex mechanism)
            lastDividendPoints[account] = dividendPointsPerShare;
        }
    }

    /**
     * @dev Get owed dividends for an account
     */
    function _getOwedDividends(address account) internal view returns (uint256) {
        uint256 newDividendPoints = dividendPointsPerShare - lastDividendPoints[account];
        return (balanceOf(account) * newDividendPoints) / DIVIDEND_POINTS_ACCURACY;
    }

    /**
     * @dev Get pending dividends for an account
     */
    function getPendingDividends(address account) external view returns (uint256) {
        return _getOwedDividends(account);
    }

    // Admin functions
    function addMinter(address minter) external onlyOwner {
        require(minter != address(0), "Invalid minter address");
        authorizedMinters[minter] = true;
        emit MinterAdded(minter);
    }

    function removeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = false;
        emit MinterRemoved(minter);
    }

    function addBurner(address burner) external onlyOwner {
        require(burner != address(0), "Invalid burner address");
        authorizedBurners[burner] = true;
        emit BurnerAdded(burner);
    }

    function removeBurner(address burner) external onlyOwner {
        authorizedBurners[burner] = false;
        emit BurnerRemoved(burner);
    }

    function setTradingEnabled(bool _enabled) external onlyOwner {
        tradingEnabled = _enabled;
        emit TradingStatusChanged(_enabled);
    }

    function setBlacklisted(address account, bool _blacklisted) external onlyOwner {
        blacklistedAddresses[account] = _blacklisted;
    }

    function updateAssetMetadata(
        string memory _assetType,
        string memory _description,
        string memory _location,
        uint256 _totalValue,
        string memory _documentHash,
        address _custodian
    ) external onlyOwner {
        if (bytes(_assetType).length > 0) {
            metadata.assetType = _assetType;
        }
        if (bytes(_description).length > 0) {
            metadata.description = _description;
        }
        if (bytes(_location).length > 0) {
            metadata.location = _location;
        }
        if (_totalValue > 0) {
            metadata.totalValue = _totalValue;
        }
        if (bytes(_documentHash).length > 0) {
            metadata.documentHash = _documentHash;
        }
        if (_custodian != address(0)) {
            metadata.custodian = _custodian;
        }
    }

    function setAssetActive(bool _active) external onlyOwner {
        metadata.isActive = _active;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Emergency withdrawal (owner only)
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(owner()).transfer(balance);
    }
}

/**
 * @title AssetTokenizationFactory
 * @dev Factory contract for creating tokenized assets
 */
contract AssetTokenizationFactory is Ownable {
    struct TokenizedAssetInfo {
        address tokenAddress;
        address creator;
        string assetType;
        uint256 creationDate;
        bool isActive;
    }

    mapping(uint256 => TokenizedAssetInfo) public tokenizedAssets;
    mapping(address => uint256[]) public creatorAssets;
    uint256 public nextAssetId;
    
    // Fee structure
    uint256 public creationFee = 0.1 ether; // Fee in ETH
    address public feeRecipient;

    event AssetTokenized(
        uint256 indexed assetId,
        address indexed tokenAddress,
        address indexed creator,
        string assetType
    );

    constructor(address _feeRecipient) {
        feeRecipient = _feeRecipient;
    }

    function createTokenizedAsset(
        string memory _name,
        string memory _symbol,
        uint256 _totalSupply,
        TokenizedAsset.AssetMetadata memory _metadata
    ) external payable returns (address) {
        require(msg.value >= creationFee, "Insufficient creation fee");
        
        TokenizedAsset newAsset = new TokenizedAsset(
            _name,
            _symbol,
            _totalSupply,
            msg.sender,
            _metadata
        );

        uint256 assetId = nextAssetId++;
        tokenizedAssets[assetId] = TokenizedAssetInfo({
            tokenAddress: address(newAsset),
            creator: msg.sender,
            assetType: _metadata.assetType,
            creationDate: block.timestamp,
            isActive: true
        });

        creatorAssets[msg.sender].push(assetId);

        // Transfer fee
        if (msg.value > 0) {
            payable(feeRecipient).transfer(msg.value);
        }

        emit AssetTokenized(assetId, address(newAsset), msg.sender, _metadata.assetType);

        return address(newAsset);
    }

    function getCreatorAssets(address creator) external view returns (uint256[] memory) {
        return creatorAssets[creator];
    }

    function setCreationFee(uint256 _fee) external onlyOwner {
        creationFee = _fee;
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "Invalid recipient");
        feeRecipient = _recipient;
    }
}
