// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Escrow
 * @dev Smart contract escrow for secure B2B transactions
 */
contract Escrow is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    enum EscrowState {
        Created,
        Funded,
        Completed,
        Disputed,
        Cancelled,
        Released
    }

    struct EscrowData {
        address payer;
        address payee;
        address arbiter;
        uint256 amount;
        address token; // address(0) for ETH
        EscrowState state;
        uint256 deadline;
        string description;
        bytes32[] milestones;
        mapping(bytes32 => bool) completedMilestones;
        uint256 completedMilestoneCount;
    }

    // Events
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed payer,
        address indexed payee,
        uint256 amount,
        address token
    );
    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
    event MilestoneCompleted(uint256 indexed escrowId, bytes32 milestone);
    event EscrowCompleted(uint256 indexed escrowId);
    event EscrowReleased(uint256 indexed escrowId);
    event EscrowDisputed(uint256 indexed escrowId);
    event EscrowCancelled(uint256 indexed escrowId);
    event DisputeResolved(uint256 indexed escrowId, bool payerWins);

    // State variables
    uint256 public nextEscrowId;
    mapping(uint256 => EscrowData) public escrows;
    mapping(address => uint256[]) public userEscrows;

    // Fee structure
    uint256 public constant FEE_BASIS_POINTS = 100; // 1%
    uint256 public constant BASIS_POINTS = 10000;
    address public feeRecipient;

    constructor(address _feeRecipient) {
        feeRecipient = _feeRecipient;
    }

    /**
     * @dev Create a new escrow
     * @param _payee Recipient address
     * @param _arbiter Arbitrator address
     * @param _amount Escrow amount
     * @param _token Token address (address(0) for ETH)
     * @param _deadline Deadline timestamp
     * @param _description Escrow description
     * @param _milestones Array of milestone hashes
     */
    function createEscrow(
        address _payee,
        address _arbiter,
        uint256 _amount,
        address _token,
        uint256 _deadline,
        string memory _description,
        bytes32[] memory _milestones
    ) external returns (uint256) {
        require(_payee != address(0), "Invalid payee");
        require(_arbiter != address(0), "Invalid arbiter");
        require(_amount > 0, "Amount must be greater than 0");
        require(_deadline > block.timestamp, "Invalid deadline");
        require(_milestones.length > 0, "At least one milestone required");

        uint256 escrowId = nextEscrowId++;
        EscrowData storage escrow = escrows[escrowId];
        
        escrow.payer = msg.sender;
        escrow.payee = _payee;
        escrow.arbiter = _arbiter;
        escrow.amount = _amount;
        escrow.token = _token;
        escrow.state = EscrowState.Created;
        escrow.deadline = _deadline;
        escrow.description = _description;
        escrow.milestones = _milestones;
        escrow.completedMilestoneCount = 0;

        userEscrows[msg.sender].push(escrowId);
        userEscrows[_payee].push(escrowId);

        emit EscrowCreated(escrowId, msg.sender, _payee, _amount, _token);

        return escrowId;
    }

    /**
     * @dev Fund the escrow
     * @param _escrowId Escrow ID
     */
    function fundEscrow(uint256 _escrowId) external payable nonReentrant {
        EscrowData storage escrow = escrows[_escrowId];
        require(escrow.payer == msg.sender, "Only payer can fund");
        require(escrow.state == EscrowState.Created, "Invalid state");

        if (escrow.token == address(0)) {
            require(msg.value == escrow.amount, "Incorrect ETH amount");
        } else {
            require(msg.value == 0, "ETH not expected");
            IERC20(escrow.token).safeTransferFrom(
                msg.sender,
                address(this),
                escrow.amount
            );
        }

        escrow.state = EscrowState.Funded;
        emit EscrowFunded(_escrowId, escrow.amount);
    }

    /**
     * @dev Complete a milestone
     * @param _escrowId Escrow ID
     * @param _milestone Milestone hash
     */
    function completeMilestone(uint256 _escrowId, bytes32 _milestone) external {
        EscrowData storage escrow = escrows[_escrowId];
        require(
            msg.sender == escrow.payee || msg.sender == escrow.arbiter,
            "Only payee or arbiter can complete milestones"
        );
        require(escrow.state == EscrowState.Funded, "Escrow not funded");
        require(block.timestamp <= escrow.deadline, "Deadline passed");

        // Verify milestone exists
        bool milestoneExists = false;
        for (uint256 i = 0; i < escrow.milestones.length; i++) {
            if (escrow.milestones[i] == _milestone) {
                milestoneExists = true;
                break;
            }
        }
        require(milestoneExists, "Milestone does not exist");
        require(!escrow.completedMilestones[_milestone], "Milestone already completed");

        escrow.completedMilestones[_milestone] = true;
        escrow.completedMilestoneCount++;

        emit MilestoneCompleted(_escrowId, _milestone);

        // Check if all milestones are completed
        if (escrow.completedMilestoneCount == escrow.milestones.length) {
            escrow.state = EscrowState.Completed;
            emit EscrowCompleted(_escrowId);
        }
    }

    /**
     * @dev Release funds to payee
     * @param _escrowId Escrow ID
     */
    function releaseFunds(uint256 _escrowId) external nonReentrant {
        EscrowData storage escrow = escrows[_escrowId];
        require(
            msg.sender == escrow.payer || 
            (escrow.state == EscrowState.Completed && msg.sender == escrow.payee),
            "Unauthorized"
        );
        require(
            escrow.state == EscrowState.Funded || escrow.state == EscrowState.Completed,
            "Invalid state"
        );

        escrow.state = EscrowState.Released;

        // Calculate fee
        uint256 fee = (escrow.amount * FEE_BASIS_POINTS) / BASIS_POINTS;
        uint256 payeeAmount = escrow.amount - fee;

        if (escrow.token == address(0)) {
            // Transfer ETH
            payable(escrow.payee).transfer(payeeAmount);
            if (fee > 0) {
                payable(feeRecipient).transfer(fee);
            }
        } else {
            // Transfer ERC20
            IERC20(escrow.token).safeTransfer(escrow.payee, payeeAmount);
            if (fee > 0) {
                IERC20(escrow.token).safeTransfer(feeRecipient, fee);
            }
        }

        emit EscrowReleased(_escrowId);
    }

    /**
     * @dev Dispute the escrow
     * @param _escrowId Escrow ID
     */
    function disputeEscrow(uint256 _escrowId) external {
        EscrowData storage escrow = escrows[_escrowId];
        require(
            msg.sender == escrow.payer || msg.sender == escrow.payee,
            "Only payer or payee can dispute"
        );
        require(
            escrow.state == EscrowState.Funded || escrow.state == EscrowState.Completed,
            "Invalid state"
        );

        escrow.state = EscrowState.Disputed;
        emit EscrowDisputed(_escrowId);
    }

    /**
     * @dev Resolve dispute (arbiter only)
     * @param _escrowId Escrow ID
     * @param _payerWins True if payer wins, false if payee wins
     */
    function resolveDispute(uint256 _escrowId, bool _payerWins) external nonReentrant {
        EscrowData storage escrow = escrows[_escrowId];
        require(msg.sender == escrow.arbiter, "Only arbiter can resolve");
        require(escrow.state == EscrowState.Disputed, "Not disputed");

        escrow.state = _payerWins ? EscrowState.Cancelled : EscrowState.Released;

        address recipient = _payerWins ? escrow.payer : escrow.payee;
        uint256 amount = escrow.amount;

        if (_payerWins) {
            // Refund to payer (no fee)
            if (escrow.token == address(0)) {
                payable(recipient).transfer(amount);
            } else {
                IERC20(escrow.token).safeTransfer(recipient, amount);
            }
        } else {
            // Pay to payee (with fee)
            uint256 fee = (amount * FEE_BASIS_POINTS) / BASIS_POINTS;
            uint256 payeeAmount = amount - fee;

            if (escrow.token == address(0)) {
                payable(recipient).transfer(payeeAmount);
                if (fee > 0) {
                    payable(feeRecipient).transfer(fee);
                }
            } else {
                IERC20(escrow.token).safeTransfer(recipient, payeeAmount);
                if (fee > 0) {
                    IERC20(escrow.token).safeTransfer(feeRecipient, fee);
                }
            }
        }

        emit DisputeResolved(_escrowId, _payerWins);
    }

    /**
     * @dev Cancel escrow (before funding)
     * @param _escrowId Escrow ID
     */
    function cancelEscrow(uint256 _escrowId) external {
        EscrowData storage escrow = escrows[_escrowId];
        require(msg.sender == escrow.payer, "Only payer can cancel");
        require(escrow.state == EscrowState.Created, "Cannot cancel funded escrow");

        escrow.state = EscrowState.Cancelled;
        emit EscrowCancelled(_escrowId);
    }

    // View functions
    function getEscrow(uint256 _escrowId)
        external
        view
        returns (
            address payer,
            address payee,
            address arbiter,
            uint256 amount,
            address token,
            EscrowState state,
            uint256 deadline,
            string memory description,
            bytes32[] memory milestones,
            uint256 completedMilestoneCount
        )
    {
        EscrowData storage escrow = escrows[_escrowId];
        return (
            escrow.payer,
            escrow.payee,
            escrow.arbiter,
            escrow.amount,
            escrow.token,
            escrow.state,
            escrow.deadline,
            escrow.description,
            escrow.milestones,
            escrow.completedMilestoneCount
        );
    }

    function isMilestoneCompleted(uint256 _escrowId, bytes32 _milestone)
        external
        view
        returns (bool)
    {
        return escrows[_escrowId].completedMilestones[_milestone];
    }

    function getUserEscrows(address _user) external view returns (uint256[] memory) {
        return userEscrows[_user];
    }

    // Admin functions
    function updateFeeRecipient(address _newRecipient) external onlyOwner {
        require(_newRecipient != address(0), "Invalid recipient");
        feeRecipient = _newRecipient;
    }
}
