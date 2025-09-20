// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title GovernanceToken
 * @dev ERC20 token with voting capabilities for DAO governance
 */
contract GovernanceToken is ERC20, ERC20Permit, ERC20Votes, Ownable {
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _totalSupply,
        address _owner
    ) ERC20(_name, _symbol) ERC20Permit(_name) {
        _mint(_owner, _totalSupply);
        _transferOwnership(_owner);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // Required overrides
    function _afterTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._burn(account, amount);
    }
}

/**
 * @title DAOGovernance
 * @dev Decentralized governance contract for CryptoHybrid Bank
 */
contract DAOGovernance is ReentrancyGuard, Ownable {
    GovernanceToken public governanceToken;

    enum ProposalState {
        Pending,
        Active,
        Cancelled,
        Defeated,
        Succeeded,
        Queued,
        Expired,
        Executed
    }

    enum VoteType {
        Against,
        For,
        Abstain
    }

    struct ProposalCore {
        uint256 id;
        address proposer;
        uint256 startBlock;
        uint256 endBlock;
        string description;
        ProposalState state;
    }

    struct ProposalVote {
        uint256 againstVotes;
        uint256 forVotes;
        uint256 abstainVotes;
        mapping(address => bool) hasVoted;
        mapping(address => VoteType) votes;
    }

    struct ProposalExecution {
        address[] targets;
        uint256[] values;
        string[] signatures;
        bytes[] calldatas;
        uint256 eta; // Execution time
    }

    // Configuration
    uint256 public constant VOTING_DELAY = 1; // 1 block
    uint256 public constant VOTING_PERIOD = 17280; // ~3 days in blocks
    uint256 public constant PROPOSAL_THRESHOLD = 100000e18; // 100k tokens
    uint256 public constant QUORUM_PERCENTAGE = 4; // 4%
    uint256 public constant TIMELOCK_DELAY = 2 days;

    // State
    uint256 public proposalCount;
    mapping(uint256 => ProposalCore) public proposals;
    mapping(uint256 => ProposalVote) public proposalVotes;
    mapping(uint256 => ProposalExecution) public proposalExecutions;
    mapping(bytes32 => bool) public queuedTransactions;

    // Events
    event ProposalCreated(
        uint256 id,
        address proposer,
        address[] targets,
        uint256[] values,
        string[] signatures,
        bytes[] calldatas,
        uint256 startBlock,
        uint256 endBlock,
        string description
    );

    event VoteCast(
        address indexed voter,
        uint256 proposalId,
        uint8 support,
        uint256 weight,
        string reason
    );

    event ProposalCanceled(uint256 id);
    event ProposalQueued(uint256 id, uint256 eta);
    event ProposalExecuted(uint256 id);

    constructor(address _governanceToken) {
        governanceToken = GovernanceToken(_governanceToken);
    }

    /**
     * @dev Create a new proposal
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas,
        string memory description
    ) external returns (uint256) {
        require(
            governanceToken.getPastVotes(msg.sender, block.number - 1) >= PROPOSAL_THRESHOLD,
            "Proposer votes below proposal threshold"
        );

        require(targets.length == values.length, "Invalid proposal length");
        require(targets.length == signatures.length, "Invalid proposal length");
        require(targets.length == calldatas.length, "Invalid proposal length");
        require(targets.length > 0, "Must provide actions");

        uint256 proposalId = ++proposalCount;
        uint256 startBlock = block.number + VOTING_DELAY;
        uint256 endBlock = startBlock + VOTING_PERIOD;

        proposals[proposalId] = ProposalCore({
            id: proposalId,
            proposer: msg.sender,
            startBlock: startBlock,
            endBlock: endBlock,
            description: description,
            state: ProposalState.Pending
        });

        ProposalExecution storage execution = proposalExecutions[proposalId];
        execution.targets = targets;
        execution.values = values;
        execution.signatures = signatures;
        execution.calldatas = calldatas;

        emit ProposalCreated(
            proposalId,
            msg.sender,
            targets,
            values,
            signatures,
            calldatas,
            startBlock,
            endBlock,
            description
        );

        return proposalId;
    }

    /**
     * @dev Cast a vote on a proposal
     */
    function castVote(uint256 proposalId, uint8 support) external {
        return _castVote(proposalId, msg.sender, support, "");
    }

    /**
     * @dev Cast a vote with reason
     */
    function castVoteWithReason(
        uint256 proposalId,
        uint8 support,
        string calldata reason
    ) external {
        return _castVote(proposalId, msg.sender, support, reason);
    }

    /**
     * @dev Internal vote casting logic
     */
    function _castVote(
        uint256 proposalId,
        address voter,
        uint8 support,
        string memory reason
    ) internal {
        require(state(proposalId) == ProposalState.Active, "Voting is closed");
        require(support <= 2, "Invalid vote type");

        ProposalVote storage proposalVote = proposalVotes[proposalId];
        require(!proposalVote.hasVoted[voter], "Already voted");

        uint256 weight = governanceToken.getPastVotes(voter, proposals[proposalId].startBlock);
        require(weight > 0, "No voting power");

        proposalVote.hasVoted[voter] = true;
        proposalVote.votes[voter] = VoteType(support);

        if (support == 0) {
            proposalVote.againstVotes += weight;
        } else if (support == 1) {
            proposalVote.forVotes += weight;
        } else {
            proposalVote.abstainVotes += weight;
        }

        emit VoteCast(voter, proposalId, support, weight, reason);
    }

    /**
     * @dev Queue a successful proposal for execution
     */
    function queue(uint256 proposalId) external {
        require(state(proposalId) == ProposalState.Succeeded, "Proposal cannot be queued");

        ProposalExecution storage execution = proposalExecutions[proposalId];
        uint256 eta = block.timestamp + TIMELOCK_DELAY;
        execution.eta = eta;

        for (uint256 i = 0; i < execution.targets.length; i++) {
            bytes32 txHash = keccak256(
                abi.encode(
                    execution.targets[i],
                    execution.values[i],
                    execution.signatures[i],
                    execution.calldatas[i],
                    eta
                )
            );
            queuedTransactions[txHash] = true;
        }

        proposals[proposalId].state = ProposalState.Queued;
        emit ProposalQueued(proposalId, eta);
    }

    /**
     * @dev Execute a queued proposal
     */
    function execute(uint256 proposalId) external payable nonReentrant {
        require(state(proposalId) == ProposalState.Queued, "Proposal cannot be executed");

        ProposalExecution storage execution = proposalExecutions[proposalId];
        require(block.timestamp >= execution.eta, "Transaction hasn't surpassed time lock");
        require(block.timestamp <= execution.eta + 14 days, "Transaction is stale");

        proposals[proposalId].state = ProposalState.Executed;

        for (uint256 i = 0; i < execution.targets.length; i++) {
            bytes32 txHash = keccak256(
                abi.encode(
                    execution.targets[i],
                    execution.values[i],
                    execution.signatures[i],
                    execution.calldatas[i],
                    execution.eta
                )
            );
            require(queuedTransactions[txHash], "Transaction hasn't been queued");

            queuedTransactions[txHash] = false;

            bytes memory callData;
            if (bytes(execution.signatures[i]).length == 0) {
                callData = execution.calldatas[i];
            } else {
                callData = abi.encodePacked(
                    bytes4(keccak256(bytes(execution.signatures[i]))),
                    execution.calldatas[i]
                );
            }

            (bool success, ) = execution.targets[i].call{value: execution.values[i]}(callData);
            require(success, "Transaction execution reverted");
        }

        emit ProposalExecuted(proposalId);
    }

    /**
     * @dev Cancel a proposal
     */
    function cancel(uint256 proposalId) external {
        ProposalCore storage proposal = proposals[proposalId];
        require(
            msg.sender == proposal.proposer ||
            governanceToken.getPastVotes(proposal.proposer, block.number - 1) < PROPOSAL_THRESHOLD,
            "Cannot cancel"
        );

        proposal.state = ProposalState.Cancelled;
        emit ProposalCanceled(proposalId);
    }

    /**
     * @dev Get the current state of a proposal
     */
    function state(uint256 proposalId) public view returns (ProposalState) {
        require(proposalId > 0 && proposalId <= proposalCount, "Invalid proposal id");

        ProposalCore storage proposal = proposals[proposalId];

        if (proposal.state == ProposalState.Cancelled) {
            return ProposalState.Cancelled;
        } else if (proposal.state == ProposalState.Executed) {
            return ProposalState.Executed;
        } else if (proposal.state == ProposalState.Queued) {
            if (block.timestamp >= proposalExecutions[proposalId].eta + 14 days) {
                return ProposalState.Expired;
            } else {
                return ProposalState.Queued;
            }
        } else if (block.number <= proposal.startBlock) {
            return ProposalState.Pending;
        } else if (block.number <= proposal.endBlock) {
            return ProposalState.Active;
        } else if (_quorumReached(proposalId) && _voteSucceeded(proposalId)) {
            return ProposalState.Succeeded;
        } else {
            return ProposalState.Defeated;
        }
    }

    /**
     * @dev Check if quorum is reached for a proposal
     */
    function _quorumReached(uint256 proposalId) internal view returns (bool) {
        ProposalVote storage proposalVote = proposalVotes[proposalId];
        uint256 totalVotes = proposalVote.forVotes + proposalVote.againstVotes + proposalVote.abstainVotes;
        uint256 quorum = (governanceToken.getPastTotalSupply(proposals[proposalId].startBlock) * QUORUM_PERCENTAGE) / 100;
        return totalVotes >= quorum;
    }

    /**
     * @dev Check if a proposal vote succeeded
     */
    function _voteSucceeded(uint256 proposalId) internal view returns (bool) {
        ProposalVote storage proposalVote = proposalVotes[proposalId];
        return proposalVote.forVotes > proposalVote.againstVotes;
    }

    // View functions
    function getProposal(uint256 proposalId)
        external
        view
        returns (
            address proposer,
            uint256 startBlock,
            uint256 endBlock,
            string memory description,
            ProposalState currentState
        )
    {
        ProposalCore storage proposal = proposals[proposalId];
        return (
            proposal.proposer,
            proposal.startBlock,
            proposal.endBlock,
            proposal.description,
            state(proposalId)
        );
    }

    function getProposalVotes(uint256 proposalId)
        external
        view
        returns (
            uint256 againstVotes,
            uint256 forVotes,
            uint256 abstainVotes
        )
    {
        ProposalVote storage proposalVote = proposalVotes[proposalId];
        return (proposalVote.againstVotes, proposalVote.forVotes, proposalVote.abstainVotes);
    }

    function hasVoted(uint256 proposalId, address account) external view returns (bool) {
        return proposalVotes[proposalId].hasVoted[account];
    }
}
