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

This project includes full integration with `@hirosystems/chainhooks-client` for monitoring contract events in real-time.

### Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create configuration file:**
   ```bash
   cp chainhooks.config.json.example chainhooks.config.json
   # Edit chainhooks.config.json with your API key and contract address
   ```

   Or set environment variables:
   ```bash
   export CHAINHOOKS_API_KEY="your-api-key"
   export CONTRACT_ADDRESS="ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
   export CHAINHOOKS_NETWORK="testnet"
   export WEBHOOK_URL="http://localhost:3000/api/hooks"
   ```

3. **Register chainhooks:**
   ```bash
   npm run chainhooks:register
   ```

### Available Commands

- `npm run chainhooks:register` - Register all hooks (proposal, approval, execution)
- `npm run chainhooks:register-proposal` - Register proposal hook only
- `npm run chainhooks:register-approval` - Register approval hook only
- `npm run chainhooks:register-execution` - Register execution hook only
- `npm run chainhooks:list` - List all registered hooks
- `npm run chainhooks:delete <uuid>` - Delete a specific hook
- `npm run chainhooks:delete-all` - Delete all multbox hooks

### Webhook Server

A sample webhook server is included to receive chainhook events:

```bash
npm run webhook:server
```

This starts a server on `http://localhost:3000` that receives:
- `POST /api/hooks/proposal` - Transaction proposals
- `POST /api/hooks/approval` - Transaction approvals  
- `POST /api/hooks/execution` - Transaction executions

### Programmatic Usage

```typescript
import { MultboxChainhooks } from './src/chainhooks.js';

const chainhooks = new MultboxChainhooks({
  apiKey: 'your-api-key',
  network: 'testnet',
  webhookUrl: 'http://localhost:3000/api/hooks',
  contractAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
});

// Register all hooks
await chainhooks.registerAllHooks();

// Or register individually
await chainhooks.registerProposalHook();
await chainhooks.registerApprovalHook();
await chainhooks.registerExecutionHook();

// List hooks
await chainhooks.listHooks();

// Delete hooks
await chainhooks.deleteHook('hook-uuid');
await chainhooks.deleteAllHooks();
```

### Configuration

Configuration can be provided via:
1. Environment variables (highest priority)
2. `chainhooks.config.json` file
3. Programmatic configuration

Required:
- `CHAINHOOKS_API_KEY` - Your Chainhooks API key
- `CONTRACT_ADDRESS` - Your deployed contract address

Optional:
- `CHAINHOOKS_NETWORK` - Network: `testnet`, `mainnet`, or `devnet` (default: `testnet`)
- `WEBHOOK_URL` - Your webhook endpoint URL (default: `http://localhost:3000/api/hooks`)
- `WEBHOOK_SECRET` - Optional secret for webhook authentication

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
