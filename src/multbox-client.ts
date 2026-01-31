/**
 * Multbox Client - Integration of @stacks/connect and @stacks/transactions
 * 
 * This module provides a client for interacting with the multbox contract
 * using Stacks Connect for wallet authentication and transaction signing.
 */

import {
  openContractCall,
  UserSession,
  showConnect,
  AuthOptions,
  FinishedAuthData,
} from '@stacks/connect';
import {
  AnchorMode,
  broadcastTransaction,
  ContractCallOptions,
  makeContractCall,
  PostConditionMode,
  standardPrincipalCV,
  uintCV,
  stringAsciiCV,
  listCV,
  tupleCV,
  someCV,
  noneCV,
  ClarityValue,
} from '@stacks/transactions';
import type { StacksNetwork } from '@stacks/network';

export interface MultboxClientConfig {
  contractAddress: string;
  contractName?: string;
  network?: 'mainnet' | 'testnet' | 'devnet';
  appName?: string;
  appIconUrl?: string;
  redirectPath?: string;
}

export interface ProposeTransactionParams {
  recipient: string;
  amount: bigint | number;
  tokenContract?: string;
  metadata?: string;
}

export interface BatchTransfer {
  recipient: string;
  amount: bigint | number;
  tokenContract?: string;
}

export interface ProposeBatchTransactionParams {
  transfers: BatchTransfer[];
  metadata?: string;
}

export interface GovernanceProposalParams {
  metadata?: string;
}

export class MultboxClient {
  private contractAddress: string;
  private contractName: string;
  private network: StacksNetwork;
  private networkName: 'mainnet' | 'testnet';
  private appName: string;
  private appIconUrl?: string;
  private redirectPath: string;
  private userSession?: UserSession;

  constructor(config: MultboxClientConfig) {
    this.contractAddress = config.contractAddress;
    this.contractName = config.contractName || 'multbox';
    this.appName = config.appName || 'Multbox';
    this.appIconUrl = config.appIconUrl;
    this.redirectPath = config.redirectPath || '/';

    // Set up network
    this.networkName = config.network === 'mainnet' ? 'mainnet' : 'testnet';
    // Network object will be created when needed via networkName
    this.network = this.networkName as unknown as StacksNetwork;

    // Initialize user session if in browser environment
    if (typeof window !== 'undefined') {
      const coreNode = this.networkName === 'mainnet' 
        ? 'https://api.hiro.so'
        : 'https://api.testnet.hiro.so';
      
      this.userSession = new UserSession({
        appConfig: {
          coreNode,
          redirectPath: this.redirectPath,
          manifestPath: '/manifest.json',
          scopes: ['publish_data', 'store_write'],
        },
      });
    }
  }

  /**
   * Get the current network name
   */
  getNetworkName(): 'mainnet' | 'testnet' {
    return this.networkName;
  }

  /**
   * Get the contract identifier
   */
  getContractIdentifier(): string {
    return `${this.contractAddress}.${this.contractName}`;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.userSession?.isUserSignedIn() ?? false;
  }

  /**
   * Get the current user's address
   */
  getUserAddress(): string | undefined {
    return this.userSession?.loadUserData()?.profile?.stxAddress?.mainnet;
  }

  /**
   * Connect wallet using Stacks Connect
   */
  async connectWallet(options?: Partial<AuthOptions>): Promise<FinishedAuthData> {
    if (typeof window === 'undefined') {
      throw new Error('connectWallet can only be called in a browser environment');
    }

    return new Promise((resolve, reject) => {
      showConnect({
        appDetails: {
          name: this.appName,
          ...(this.appIconUrl && { icon: this.appIconUrl }),
        },
        onFinish: (data) => {
          resolve(data);
        },
        onCancel: () => {
          reject(new Error('User cancelled wallet connection'));
        },
        ...options,
      });
    });
  }

  /**
   * Disconnect wallet
   */
  disconnectWallet(): void {
    this.userSession?.signUserOut();
  }

  /**
   * Propose a transaction (STX or token transfer)
   */
  async proposeTransaction(
    params: ProposeTransactionParams,
    options?: Partial<ContractCallOptions>
  ): Promise<void> {
    const functionArgs = [
      standardPrincipalCV(params.recipient),
      uintCV(params.amount),
      params.tokenContract
        ? someCV(standardPrincipalCV(params.tokenContract))
        : noneCV(),
      params.metadata
        ? someCV(stringAsciiCV(params.metadata))
        : noneCV(),
    ];

    await this.openContractCall({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'propose-transaction',
      functionArgs,
      ...options,
    });
  }

  /**
   * Propose a batch transaction
   */
  async proposeBatchTransaction(
    params: ProposeBatchTransactionParams,
    options?: Partial<ContractCallOptions>
  ): Promise<void> {
    const transfers = listCV(
      params.transfers.map((transfer) =>
        tupleCV({
          recipient: standardPrincipalCV(transfer.recipient),
          amount: uintCV(transfer.amount),
          'token-contract': transfer.tokenContract
            ? someCV(standardPrincipalCV(transfer.tokenContract))
            : noneCV(),
        })
      )
    );

    const functionArgs = [
      transfers,
      params.metadata
        ? someCV(stringAsciiCV(params.metadata))
        : noneCV(),
    ];

    await this.openContractCall({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'propose-batch-transaction',
      functionArgs,
      ...options,
    });
  }

  /**
   * Approve a transaction
   */
  async approveTransaction(
    txId: number | bigint,
    options?: Partial<ContractCallOptions>
  ): Promise<void> {
    await this.openContractCall({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'approve-transaction',
      functionArgs: [uintCV(txId)],
      ...options,
    });
  }

  /**
   * Revoke approval for a transaction
   */
  async revokeApproval(
    txId: number | bigint,
    options?: Partial<ContractCallOptions>
  ): Promise<void> {
    await this.openContractCall({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'revoke-approval',
      functionArgs: [uintCV(txId)],
      ...options,
    });
  }

  /**
   * Execute a transaction
   */
  async executeTransaction(
    txId: number | bigint,
    tokenTrait?: string,
    options?: Partial<ContractCallOptions>
  ): Promise<void> {
    const functionArgs = [
      uintCV(txId),
      tokenTrait ? someCV(standardPrincipalCV(tokenTrait)) : noneCV(),
    ];

    await this.openContractCall({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'execute-transaction',
      functionArgs,
      ...options,
    });
  }

  /**
   * Cancel a transaction
   */
  async cancelTransaction(
    txId: number | bigint,
    options?: Partial<ContractCallOptions>
  ): Promise<void> {
    await this.openContractCall({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'cancel-transaction',
      functionArgs: [uintCV(txId)],
      ...options,
    });
  }

  /**
   * Propose adding a board member
   */
  async proposeAddMember(
    newMember: string,
    metadata?: string,
    options?: Partial<ContractCallOptions>
  ): Promise<void> {
    await this.openContractCall({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'propose-add-member',
      functionArgs: [
        standardPrincipalCV(newMember),
        metadata ? someCV(stringAsciiCV(metadata)) : noneCV(),
      ],
      ...options,
    });
  }

  /**
   * Propose removing a board member
   */
  async proposeRemoveMember(
    memberToRemove: string,
    metadata?: string,
    options?: Partial<ContractCallOptions>
  ): Promise<void> {
    await this.openContractCall({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'propose-remove-member',
      functionArgs: [
        standardPrincipalCV(memberToRemove),
        metadata ? someCV(stringAsciiCV(metadata)) : noneCV(),
      ],
      ...options,
    });
  }

  /**
   * Propose updating the approval threshold
   */
  async proposeUpdateThreshold(
    newThreshold: number | bigint,
    metadata?: string,
    options?: Partial<ContractCallOptions>
  ): Promise<void> {
    await this.openContractCall({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'propose-update-threshold',
      functionArgs: [
        uintCV(newThreshold),
        metadata ? someCV(stringAsciiCV(metadata)) : noneCV(),
      ],
      ...options,
    });
  }

  /**
   * Propose pausing the contract
   */
  async proposePause(
    metadata?: string,
    options?: Partial<ContractCallOptions>
  ): Promise<void> {
    await this.openContractCall({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'propose-pause',
      functionArgs: [
        metadata ? someCV(stringAsciiCV(metadata)) : noneCV(),
      ],
      ...options,
    });
  }

  /**
   * Propose unpausing the contract
   */
  async proposeUnpause(
    metadata?: string,
    options?: Partial<ContractCallOptions>
  ): Promise<void> {
    await this.openContractCall({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'propose-unpause',
      functionArgs: [
        metadata ? someCV(stringAsciiCV(metadata)) : noneCV(),
      ],
      ...options,
    });
  }

  /**
   * Initialize the contract (one-time only)
   */
  async initialize(
    members: string[],
    options?: Partial<ContractCallOptions>
  ): Promise<void> {
    if (members.length !== 20) {
      throw new Error('Must provide exactly 20 board members');
    }

    const membersList = listCV(
      members.map((member) => standardPrincipalCV(member))
    );

    await this.openContractCall({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'initialize',
      functionArgs: [membersList],
      ...options,
    });
  }

  /**
   * Open contract call using Stacks Connect
   */
  private async openContractCall(
    options: ContractCallOptions
  ): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('openContractCall can only be called in a browser environment');
    }

    return new Promise((resolve, reject) => {
      openContractCall({
        contractAddress: options.contractAddress,
        contractName: options.contractName,
        functionName: options.functionName,
        functionArgs: options.functionArgs || [],
        network: this.networkName,
        appDetails: {
          name: this.appName,
          icon: this.appIconUrl,
        },
        postConditionMode: options.postConditionMode || PostConditionMode.Allow,
        postConditions: options.postConditions || [],
        onFinish: () => {
          resolve();
        },
        onCancel: () => {
          reject(new Error('User cancelled transaction'));
        },
        fee: options.fee,
        sponsored: options.sponsored,
      });
    });
  }

  /**
   * Build a contract call transaction (for programmatic use without Connect)
   */
  async buildContractCall(
    functionName: string,
    functionArgs: ClarityValue[],
    options: { senderKey: string; nonce?: number; fee?: number | bigint; sponsored?: boolean }
  ) {
    const senderKey = options.senderKey;
    if (!senderKey) {
      throw new Error('senderKey is required for buildContractCall');
    }

    return makeContractCall({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName,
      functionArgs,
      senderKey,
      network: this.networkName,
      postConditionMode: PostConditionMode.Allow,
      postConditions: [],
      anchorMode: AnchorMode.Any,
      fee: options.fee,
      nonce: options.nonce,
      sponsored: options.sponsored,
    });
  }

  /**
   * Broadcast a transaction
   */
  async broadcastTransaction(tx: string | Uint8Array) {
    return broadcastTransaction(tx, this.networkName);
  }
}
