/**
 * Multbox Reader - Read-only contract interactions using @stacks/transactions
 * 
 * This module provides functions to read contract state without requiring
 * wallet authentication or transaction signing.
 */

import {
  fetchCallReadOnlyFunction,
  cvToValue,
  standardPrincipalCV,
  uintCV,
  cvToString,
} from '@stacks/transactions';

export interface MultboxReaderConfig {
  contractAddress: string;
  contractName?: string;
  network?: 'mainnet' | 'testnet' | 'devnet';
}

export interface Transaction {
  proposer: string;
  'tx-type': number;
  recipient: string;
  amount: bigint;
  'token-contract': string | null;
  executed: boolean;
  cancelled: boolean;
  'approval-count': number;
  'created-at': number;
  'expires-at': number;
  metadata: string | null;
  'batch-transfers': Array<{
    recipient: string;
    amount: bigint;
    'token-contract': string | null;
  }> | null;
  'new-member': string | null;
  'threshold-value': number | null;
}

export class MultboxReader {
  private contractAddress: string;
  private contractName: string;
  private network: 'mainnet' | 'testnet';

  constructor(config: MultboxReaderConfig) {
    this.contractAddress = config.contractAddress;
    this.contractName = config.contractName || 'multbox';

    // Set up network
    this.network = config.network === 'mainnet' ? 'mainnet' : 'testnet';
  }

  /**
   * Get the contract identifier
   */
  getContractIdentifier(): string {
    return `${this.contractAddress}.${this.contractName}`;
  }

  /**
   * Check if a principal is a board member
   */
  async isBoardMember(member: string): Promise<boolean> {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'is-board-member',
      functionArgs: [standardPrincipalCV(member)],
      network: this.network,
      senderAddress: this.contractAddress,
    });

    return cvToValue(result) as boolean;
  }

  /**
   * Get the total number of board members
   */
  async getBoardMemberCount(): Promise<number> {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'get-board-member-count',
      functionArgs: [],
      network: this.network,
      senderAddress: this.contractAddress,
    });

    return Number(cvToValue(result));
  }

  /**
   * Get transaction details by ID
   */
  async getTransaction(txId: number | bigint): Promise<Transaction | null> {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'get-transaction',
      functionArgs: [uintCV(txId)],
      network: this.network,
      senderAddress: this.contractAddress,
    });

    const value = cvToValue(result);
    if (!value || (typeof value === 'object' && 'value' in value && value.value === null)) {
      return null;
    }

    return this.parseTransaction(value);
  }

  /**
   * Check if a member has approved a transaction
   */
  async hasApproved(txId: number | bigint, member: string): Promise<boolean> {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'has-approved',
      functionArgs: [uintCV(txId), standardPrincipalCV(member)],
      network: this.network,
      senderAddress: this.contractAddress,
    });

    return cvToValue(result) as boolean;
  }

  /**
   * Get the approval count for a transaction
   */
  async getApprovalCount(txId: number | bigint): Promise<number> {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'get-approval-count',
      functionArgs: [uintCV(txId)],
      network: this.network,
      senderAddress: this.contractAddress,
    });

    return Number(cvToValue(result));
  }

  /**
   * Get list of approvers for a transaction
   */
  async getApprovers(txId: number | bigint): Promise<string[]> {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'get-approvers',
      functionArgs: [uintCV(txId)],
      network: this.network,
      senderAddress: this.contractAddress,
    });

    const value = cvToValue(result);
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.map((v: any) => cvToString(v));
    }

    return [];
  }

  /**
   * Get transaction expiry block height
   */
  async getTransactionExpiresAt(txId: number | bigint): Promise<number> {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'get-transaction-expires-at',
      functionArgs: [uintCV(txId)],
      network: this.network,
      senderAddress: this.contractAddress,
    });

    return Number(cvToValue(result));
  }

  /**
   * Get total number of transactions
   */
  async getTotalTransactions(): Promise<number> {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'get-total-transactions',
      functionArgs: [],
      network: this.network,
      senderAddress: this.contractAddress,
    });

    return Number(cvToValue(result));
  }

  /**
   * Get number of executed transactions
   */
  async getExecutedTransactions(): Promise<number> {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'get-executed-transactions',
      functionArgs: [],
      network: this.network,
      senderAddress: this.contractAddress,
    });

    return Number(cvToValue(result));
  }

  /**
   * Get number of cancelled transactions
   */
  async getCancelledTransactions(): Promise<number> {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'get-cancelled-transactions',
      functionArgs: [],
      network: this.network,
      senderAddress: this.contractAddress,
    });

    return Number(cvToValue(result));
  }

  /**
   * Get number of expired transactions
   */
  async getExpiredTransactions(): Promise<number> {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'get-expired-transactions',
      functionArgs: [],
      network: this.network,
      senderAddress: this.contractAddress,
    });

    return Number(cvToValue(result));
  }

  /**
   * Get number of pending transactions
   */
  async getPendingTransactionsCount(): Promise<number> {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'get-pending-transactions-count',
      functionArgs: [],
      network: this.network,
      senderAddress: this.contractAddress,
    });

    return Number(cvToValue(result));
  }

  /**
   * Get the current approval threshold
   */
  async getApprovalThreshold(): Promise<number> {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'get-approval-threshold',
      functionArgs: [],
      network: this.network,
      senderAddress: this.contractAddress,
    });

    return Number(cvToValue(result));
  }

  /**
   * Check if contract is paused
   */
  async isPaused(): Promise<boolean> {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'is-paused',
      functionArgs: [],
      network: this.network,
      senderAddress: this.contractAddress,
    });

    return cvToValue(result) as boolean;
  }

  /**
   * Check if contract is initialized
   */
  async isInitialized(): Promise<boolean> {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'is-initialized',
      functionArgs: [],
      network: this.network,
      senderAddress: this.contractAddress,
    });

    return cvToValue(result) as boolean;
  }

  /**
   * Parse transaction from Clarity value
   */
  private parseTransaction(value: any): Transaction {
    return {
      proposer: cvToString(value.proposer),
      'tx-type': Number(value['tx-type']),
      recipient: cvToString(value.recipient),
      amount: BigInt(value.amount),
      'token-contract': value['token-contract'] ? cvToString(value['token-contract']) : null,
      executed: value.executed,
      cancelled: value.cancelled,
      'approval-count': Number(value['approval-count']),
      'created-at': Number(value['created-at']),
      'expires-at': Number(value['expires-at']),
      metadata: value.metadata ? cvToString(value.metadata) : null,
      'batch-transfers': value['batch-transfers']
        ? (value['batch-transfers'] as any[]).map((transfer: any) => ({
            recipient: cvToString(transfer.recipient),
            amount: BigInt(transfer.amount),
            'token-contract': transfer['token-contract']
              ? cvToString(transfer['token-contract'])
              : null,
          }))
        : null,
      'new-member': value['new-member'] ? cvToString(value['new-member']) : null,
      'threshold-value': value['threshold-value'] ? Number(value['threshold-value']) : null,
    };
  }
}
