/**
 * Example usage of MultboxClient and MultboxReader
 * 
 * This file demonstrates how to use @stacks/connect and @stacks/transactions
 * to interact with the multbox contract.
 * 
 * Usage:
 *   - Browser: Import and use in your React/Vue/etc. application
 *   - Node.js: Use the programmatic methods (buildContractCall, etc.)
 */

import { MultboxClient } from './multbox-client.js';
import { MultboxReader } from './multbox-reader.js';

// Example configuration
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const NETWORK = (process.env.NETWORK || 'testnet') as 'mainnet' | 'testnet' | 'devnet';

/**
 * Example: Browser-based usage with Stacks Connect
 */
export async function browserExample() {
  // Initialize client
  const client = new MultboxClient({
    contractAddress: CONTRACT_ADDRESS,
    network: NETWORK,
    appName: 'Multbox DApp',
    appIconUrl: 'https://example.com/icon.png',
  });

  // Connect wallet
  try {
    await client.connectWallet();
    console.log('✅ Wallet connected');
    console.log('User address:', client.getUserAddress());
  } catch (error) {
    console.error('❌ Failed to connect wallet:', error);
    return;
  }

  // Propose a transaction
  try {
    await client.proposeTransaction({
      recipient: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
      amount: 1000000, // 1 STX in microstacks
      metadata: 'Payment for services',
    });
    console.log('✅ Transaction proposed');
  } catch (error) {
    console.error('❌ Failed to propose transaction:', error);
  }

  // Approve a transaction
  try {
    await client.approveTransaction(0);
    console.log('✅ Transaction approved');
  } catch (error) {
    console.error('❌ Failed to approve transaction:', error);
  }

  // Execute a transaction (once majority is reached)
  try {
    await client.executeTransaction(0);
    console.log('✅ Transaction executed');
  } catch (error) {
    console.error('❌ Failed to execute transaction:', error);
  }
}

/**
 * Example: Read-only operations (no wallet needed)
 */
export async function readOnlyExample() {
  const reader = new MultboxReader({
    contractAddress: CONTRACT_ADDRESS,
    network: NETWORK,
  });

  try {
    // Check if contract is initialized
    const isInitialized = await reader.isInitialized();
    console.log('Contract initialized:', isInitialized);

    // Get board member count
    const memberCount = await reader.getBoardMemberCount();
    console.log('Board members:', memberCount);

    // Check if address is a board member
    const isMember = await reader.isBoardMember(CONTRACT_ADDRESS);
    console.log('Is board member:', isMember);

    // Get transaction details
    const transaction = await reader.getTransaction(0);
    if (transaction) {
      console.log('Transaction:', {
        proposer: transaction.proposer,
        recipient: transaction.recipient,
        amount: transaction.amount.toString(),
        approvalCount: transaction['approval-count'],
        executed: transaction.executed,
      });
    }

    // Get approval count
    const approvalCount = await reader.getApprovalCount(0);
    console.log('Approval count:', approvalCount);

    // Get approval threshold
    const threshold = await reader.getApprovalThreshold();
    console.log('Approval threshold:', threshold);

    // Get statistics
    const stats = {
      total: await reader.getTotalTransactions(),
      executed: await reader.getExecutedTransactions(),
      cancelled: await reader.getCancelledTransactions(),
      expired: await reader.getExpiredTransactions(),
      pending: await reader.getPendingTransactionsCount(),
    };
    console.log('Transaction statistics:', stats);
  } catch (error) {
    console.error('❌ Error reading contract state:', error);
  }
}

/**
 * Example: Programmatic transaction building (Node.js/server-side)
 */
export async function programmaticExample() {
  const client = new MultboxClient({
    contractAddress: CONTRACT_ADDRESS,
    network: NETWORK,
  });

  // Note: This requires a private key (use environment variable, never commit to git!)
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY environment variable is required');
    return;
  }

  try {
    // Build a contract call transaction
    const tx = await client.buildContractCall(
      'approve-transaction',
      [uintCV(0)],
      {
        senderKey: privateKey,
      }
    );

    console.log('Transaction built:', tx.txid());

    // Broadcast the transaction
    const result = await client.broadcastTransaction(tx);
    console.log('Transaction broadcast result:', result);
  } catch (error) {
    console.error('❌ Error building/broadcasting transaction:', error);
  }
}

/**
 * Example: Governance proposals
 */
export async function governanceExample() {
  const client = new MultboxClient({
    contractAddress: CONTRACT_ADDRESS,
    network: NETWORK,
    appName: 'Multbox Governance',
  });

  try {
    // Connect wallet first
    await client.connectWallet();

    // Propose adding a new member
    await client.proposeAddMember(
      'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
      'Adding new board member'
    );

    // Propose updating threshold
    await client.proposeUpdateThreshold(12, 'Increase threshold to 12');

    // Propose pausing contract
    await client.proposePause('Emergency pause');

    // Propose unpausing contract
    await client.proposeUnpause('Resume operations');
  } catch (error) {
    console.error('❌ Error with governance operations:', error);
  }
}

/**
 * Example: Batch transactions
 */
export async function batchTransactionExample() {
  const client = new MultboxClient({
    contractAddress: CONTRACT_ADDRESS,
    network: NETWORK,
    appName: 'Multbox Batch Payments',
  });

  try {
    await client.connectWallet();

    // Propose a batch transaction
    await client.proposeBatchTransaction({
      transfers: [
        {
          recipient: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
          amount: 500000, // 0.5 STX
        },
        {
          recipient: 'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGSV7M8ED5J4',
          amount: 750000, // 0.75 STX
        },
      ],
      metadata: 'Monthly payments batch',
    });
  } catch (error) {
    console.error('❌ Error with batch transaction:', error);
  }
}

// Import uintCV for programmatic example
import { uintCV } from '@stacks/transactions';

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('📖 Multbox Integration Examples\n');

  // Read-only example (works in any environment)
  readOnlyExample()
    .then(() => {
      console.log('\n✅ Read-only example completed');
    })
    .catch((error) => {
      console.error('❌ Read-only example failed:', error);
    });
}
