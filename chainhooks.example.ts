/**
 * Example Chainhooks integration for BoardMultiSig contract
 * 
 * This file demonstrates how to use @hirosystems/chainhooks-client
 * to monitor the multbox contract for transaction proposals and executions.
 */

import { ChainhooksClient, CHAINHOOKS_BASE_URL } from '@hirosystems/chainhooks-client';

// Initialize the client
const client = new ChainhooksClient({
  baseUrl: CHAINHOOKS_BASE_URL.testnet, // Use .mainnet for mainnet
  apiKey: process.env.CHAINHOOKS_API_KEY || 'your-api-key-here',
});

/**
 * Register a chainhook to monitor transaction proposals
 */
export async function registerProposalHook(contractAddress: string) {
  const hook = {
    name: 'multbox-proposal-hook',
    chain: 'stacks',
    network: 'testnet', // or 'mainnet'
    filters: {
      scope: 'contract_call',
      contract_identifier: `${contractAddress}.multbox`,
      method: 'propose-transaction',
    },
    action: {
      http_post: {
        url: process.env.WEBHOOK_URL || 'http://localhost:3000/api/hooks/proposal',
        authorization_header: `Bearer ${process.env.WEBHOOK_SECRET || 'secret'}`,
      },
    },
  };

  try {
    const response = await client.registerChainhook(hook);
    console.log('Proposal hook registered:', response.uuid);
    return response;
  } catch (error) {
    console.error('Error registering proposal hook:', error);
    throw error;
  }
}

/**
 * Register a chainhook to monitor transaction executions
 */
export async function registerExecutionHook(contractAddress: string) {
  const hook = {
    name: 'multbox-execution-hook',
    chain: 'stacks',
    network: 'testnet', // or 'mainnet'
    filters: {
      scope: 'contract_call',
      contract_identifier: `${contractAddress}.multbox`,
      method: 'execute-transaction',
    },
    action: {
      http_post: {
        url: process.env.WEBHOOK_URL || 'http://localhost:3000/api/hooks/execution',
        authorization_header: `Bearer ${process.env.WEBHOOK_SECRET || 'secret'}`,
      },
    },
  };

  try {
    const response = await client.registerChainhook(hook);
    console.log('Execution hook registered:', response.uuid);
    return response;
  } catch (error) {
    console.error('Error registering execution hook:', error);
    throw error;
  }
}

/**
 * List all registered chainhooks
 */
export async function listHooks() {
  try {
    const hooks = await client.listChainhooks();
    console.log('Registered hooks:', hooks);
    return hooks;
  } catch (error) {
    console.error('Error listing hooks:', error);
    throw error;
  }
}

/**
 * Delete a chainhook by UUID
 */
export async function deleteHook(uuid: string) {
  try {
    await client.deleteChainhook(uuid);
    console.log('Hook deleted:', uuid);
  } catch (error) {
    console.error('Error deleting hook:', error);
    throw error;
  }
}

// Example usage:
// const contractAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
// await registerProposalHook(contractAddress);
// await registerExecutionHook(contractAddress);

