// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MultiSigWallet
 * @dev Multi-signature wallet for secure asset management
 */
contract MultiSigWallet is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 numConfirmations;
        address token; // address(0) for ETH, token address for ERC20
    }

    // Events
    event Deposit(address indexed sender, uint256 amount, uint256 balance);
    event SubmitTransaction(
        address indexed owner,
        uint256 indexed txIndex,
        address indexed to,
        uint256 value,
        bytes data,
        address token
    );
    event ConfirmTransaction(address indexed owner, uint256 indexed txIndex);
    event RevokeConfirmation(address indexed owner, uint256 indexed txIndex);
    event ExecuteTransaction(address indexed owner, uint256 indexed txIndex);
    event OwnerAddition(address indexed owner);
    event OwnerRemoval(address indexed owner);
    event RequirementChange(uint256 required);

    // State variables
    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public numConfirmationsRequired;

    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public isConfirmed;

    // Modifiers
    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not owner");
        _;
    }

    modifier txExists(uint256 _txIndex) {
        require(_txIndex < transactions.length, "Transaction does not exist");
        _;
    }

    modifier notExecuted(uint256 _txIndex) {
        require(!transactions[_txIndex].executed, "Transaction already executed");
        _;
    }

    modifier notConfirmed(uint256 _txIndex) {
        require(!isConfirmed[_txIndex][msg.sender], "Transaction already confirmed");
        _;
    }

    /**
     * @dev Constructor
     * @param _owners List of initial owners
     * @param _numConfirmationsRequired Number of confirmations required
     */
    constructor(address[] memory _owners, uint256 _numConfirmationsRequired) {
        require(_owners.length > 0, "Owners required");
        require(
            _numConfirmationsRequired > 0 &&
                _numConfirmationsRequired <= _owners.length,
            "Invalid number of required confirmations"
        );

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];

            require(owner != address(0), "Invalid owner");
            require(!isOwner[owner], "Owner not unique");

            isOwner[owner] = true;
            owners.push(owner);
        }

        numConfirmationsRequired = _numConfirmationsRequired;
    }

    /**
     * @dev Receive function to accept ETH deposits
     */
    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    /**
     * @dev Submit a transaction
     * @param _to Recipient address
     * @param _value Amount to send
     * @param _data Transaction data
     * @param _token Token address (address(0) for ETH)
     */
    function submitTransaction(
        address _to,
        uint256 _value,
        bytes memory _data,
        address _token
    ) public onlyOwner {
        uint256 txIndex = transactions.length;

        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data: _data,
                executed: false,
                numConfirmations: 0,
                token: _token
            })
        );

        emit SubmitTransaction(msg.sender, txIndex, _to, _value, _data, _token);
    }

    /**
     * @dev Confirm a transaction
     * @param _txIndex Transaction index
     */
    function confirmTransaction(uint256 _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
        notConfirmed(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];
        transaction.numConfirmations += 1;
        isConfirmed[_txIndex][msg.sender] = true;

        emit ConfirmTransaction(msg.sender, _txIndex);
    }

    /**
     * @dev Execute a transaction
     * @param _txIndex Transaction index
     */
    function executeTransaction(uint256 _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
        nonReentrant
    {
        Transaction storage transaction = transactions[_txIndex];

        require(
            transaction.numConfirmations >= numConfirmationsRequired,
            "Cannot execute transaction"
        );

        transaction.executed = true;

        if (transaction.token == address(0)) {
            // ETH transfer
            (bool success, ) = transaction.to.call{value: transaction.value}(
                transaction.data
            );
            require(success, "Transaction failed");
        } else {
            // ERC20 transfer
            IERC20(transaction.token).safeTransfer(transaction.to, transaction.value);
            
            // Execute additional data if provided
            if (transaction.data.length > 0) {
                (bool success, ) = transaction.to.call(transaction.data);
                require(success, "Transaction data execution failed");
            }
        }

        emit ExecuteTransaction(msg.sender, _txIndex);
    }

    /**
     * @dev Revoke confirmation for a transaction
     * @param _txIndex Transaction index
     */
    function revokeConfirmation(uint256 _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];

        require(isConfirmed[_txIndex][msg.sender], "Transaction not confirmed");

        transaction.numConfirmations -= 1;
        isConfirmed[_txIndex][msg.sender] = false;

        emit RevokeConfirmation(msg.sender, _txIndex);
    }

    /**
     * @dev Add a new owner
     * @param _owner New owner address
     */
    function addOwner(address _owner) public onlyOwner {
        require(_owner != address(0), "Invalid owner");
        require(!isOwner[_owner], "Owner already exists");

        isOwner[_owner] = true;
        owners.push(_owner);

        emit OwnerAddition(_owner);
    }

    /**
     * @dev Remove an owner
     * @param _owner Owner address to remove
     */
    function removeOwner(address _owner) public onlyOwner {
        require(isOwner[_owner], "Not an owner");
        require(owners.length > 1, "Cannot remove last owner");

        isOwner[_owner] = false;

        for (uint256 i = 0; i < owners.length - 1; i++) {
            if (owners[i] == _owner) {
                owners[i] = owners[owners.length - 1];
                break;
            }
        }
        owners.pop();

        if (numConfirmationsRequired > owners.length) {
            numConfirmationsRequired = owners.length;
        }

        emit OwnerRemoval(_owner);
    }

    /**
     * @dev Change the number of required confirmations
     * @param _numConfirmationsRequired New required confirmations
     */
    function changeRequirement(uint256 _numConfirmationsRequired) public onlyOwner {
        require(
            _numConfirmationsRequired > 0 &&
                _numConfirmationsRequired <= owners.length,
            "Invalid requirement"
        );

        numConfirmationsRequired = _numConfirmationsRequired;
        emit RequirementChange(_numConfirmationsRequired);
    }

    // View functions
    function getOwners() public view returns (address[] memory) {
        return owners;
    }

    function getTransactionCount() public view returns (uint256) {
        return transactions.length;
    }

    function getTransaction(uint256 _txIndex)
        public
        view
        returns (
            address to,
            uint256 value,
            bytes memory data,
            bool executed,
            uint256 numConfirmations,
            address token
        )
    {
        Transaction storage transaction = transactions[_txIndex];

        return (
            transaction.to,
            transaction.value,
            transaction.data,
            transaction.executed,
            transaction.numConfirmations,
            transaction.token
        );
    }

    /**
     * @dev Get token balance
     * @param _token Token address (address(0) for ETH)
     */
    function getBalance(address _token) public view returns (uint256) {
        if (_token == address(0)) {
            return address(this).balance;
        } else {
            return IERC20(_token).balanceOf(address(this));
        }
    }
}
