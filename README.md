# BoardMultiSig (multbox)

A secure multi-signature wallet contract for the Stacks blockchain, requiring exactly 20 board members and majority approval (11/20) for transaction execution.

## Features

- **Exactly 20 Board Members**: Contract requires exactly 20 board members at initialization
- **Transaction Proposals**: Board members can propose transactions (STX transfers)
- **Majority Voting**: Requires 11 out of 20 approvals (majority) before execution
- **Secure Execution**: Prevents double execution and unauthorized access
- **Chainhooks Integration**: Monitor contract events using `@hirosystems/chainhooks-client`

## Contract Overview

The BoardMultiSig contract ensures secure fund management through:
- Board member management (exactly 20 members)
- Transaction proposal system
- Approval tracking per transaction
- Majority-based execution (11/20 threshold)
- Reentrancy protection

## Requirements

- Clarinet 3.12.0+
- Node.js (for testing and chainhooks)
- Clarity version 4

## Installation

```bash
npm install
```

## Contract Functions

### Public Functions

- `initialize(members: list<20, principal>)`: Initialize contract with exactly 20 board members (one-time only)
- `propose-transaction(recipient: principal, amount: uint, token-contract: optional<principal>)`: Propose a new transaction (board members only)
- `approve-transaction(tx-id: uint)`: Approve a pending transaction (board members only)
- `execute-transaction(tx-id: uint)`: Execute a transaction once majority approval is reached (anyone can call)

### Read-Only Functions

- `is-board-member(member: principal)`: Check if a principal is a board member
- `get-board-member-count()`: Get total number of board members
- `get-transaction(tx-id: uint)`: Get transaction details
- `has-approved(tx-id: uint, member: principal)`: Check if a member approved a transaction
- `get-approval-count(tx-id: uint)`: Get current approval count for a transaction
- `is-initialized()`: Check if contract is initialized

## Error Codes

- `u1001`: Contract already initialized
- `u1002`: Must have exactly 20 board members
- `u1003`: Failed to add board members
- `u1004`: Contract not initialized
- `u1005`: Only board members can perform this action
- `u1006`: Amount must be greater than 0
- `u1007`: Transaction does not exist
- `u1008`: Already approved this transaction
- `u1009`: Transaction already executed
- `u1010`: Insufficient approvals (need majority)
- `u1011`: List too long (internal error)
- `u1012`: Token transfers not yet supported (STX only)

## Usage

### 1. Initialize the Contract

```clarity
(contract-call? .multbox initialize (list 
    'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
    'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG
    ;; ... 18 more board member addresses
))
```

### 2. Propose a Transaction

```clarity
(contract-call? .multbox propose-transaction 
    'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM  ;; recipient
    u1000000  ;; amount in microstacks
    none  ;; token contract (none for STX)
)
```

### 3. Approve a Transaction

```clarity
(contract-call? .multbox approve-transaction u0)  ;; tx-id
```

### 4. Execute a Transaction

Once 11 approvals are reached, anyone can execute:

```clarity
(contract-call? .multbox execute-transaction u0)  ;; tx-id
```

## Testing

Run the test suite:

```bash
npm test
```

Run tests with coverage and cost reports:

```bash
npm run test:report
```

## Chainhooks Integration

This project includes `@hirosystems/chainhooks-client` for monitoring contract events.

See `chainhooks.example.ts` for examples of:
- Registering hooks for transaction proposals
- Registering hooks for transaction executions
- Listing and managing chainhooks

### Example Chainhook Setup

```typescript
import { registerProposalHook, registerExecutionHook } from './chainhooks.example';

const contractAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';

// Register hooks
await registerProposalHook(contractAddress);
await registerExecutionHook(contractAddress);
```

## Development

### Check Contract

```bash
clarinet check
```

### Start Devnet

```bash
clarinet devnet start
```

### Deploy to Testnet/Mainnet

Update the settings in `settings/Testnet.toml` or `settings/Mainnet.toml`, then:

```bash
clarinet deploy --testnet
# or
clarinet deploy --mainnet
```

## Security Considerations

- Contract must be initialized with exactly 20 unique board members
- Majority threshold is hardcoded to 11/20 (cannot be changed after deployment)
- Transactions are marked as executed before transfer to prevent reentrancy
- Only board members can propose and approve transactions
- Each board member can only approve a transaction once

## Limitations

- Currently supports STX transfers only (token transfers require contract identifier)
- Board members cannot be changed after initialization
- Majority threshold is fixed at 11/20

## License

ISC
