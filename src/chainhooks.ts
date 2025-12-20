/**
 * Chainhooks integration for BoardMultiSig contract
 * 
 * This module provides functions to register and manage chainhooks
 * for monitoring the multbox contract events.
 */

import { ChainhooksClient, CHAINHOOKS_BASE_URL } from '@hirosystems/chainhooks-client';

export interface ChainhookConfig {
  apiKey: string;
  network: 'testnet' | 'mainnet' | 'devnet';
  webhookUrl: string;
  webhookSecret?: string;
  contractAddress: string;
}

export class MultboxChainhooks {
  private client: ChainhooksClient;
  private config: ChainhookConfig;

  constructor(config: ChainhookConfig) {
    const baseUrl = 
      config.network === 'mainnet' ? CHAINHOOKS_BASE_URL.mainnet :
      CHAINHOOKS_BASE_URL.testnet; // Use testnet for devnet as well

    this.client = new ChainhooksClient({
      baseUrl,
      apiKey: config.apiKey,
    });

    this.config = config;
  }

  /**
   * Register a chainhook to monitor transaction proposals
   */
  async registerProposalHook() {
    const hook = {
      version: '1' as const,
      name: `multbox-proposal-hook-${this.config.network}`,
      chain: 'stacks' as const,
      network: this.config.network === 'devnet' ? 'testnet' : this.config.network,
      filters: {
        events: [
          {
            type: 'contract_call' as const,
            contract_identifier: `${this.config.contractAddress}.multbox`,
            function_name: 'propose-transaction',
          },
        ],
      },
      action: {
        type: 'http_post' as const,
        url: `${this.config.webhookUrl}/proposal`,
        authorization_header: this.config.webhookSecret 
          ? `Bearer ${this.config.webhookSecret}` 
          : undefined,
      },
      options: {
        enable_on_registration: true,
        decode_clarity_values: true,
      },
    };

    try {
      const response = await this.client.registerChainhook(hook);
      console.log(`✅ Proposal hook registered: ${response.uuid}`);
      return response;
    } catch (error) {
      console.error('❌ Error registering proposal hook:', error);
      throw error;
    }
  }

  /**
   * Register a chainhook to monitor transaction approvals
   */
  async registerApprovalHook() {
    const hook = {
      version: '1' as const,
      name: `multbox-approval-hook-${this.config.network}`,
      chain: 'stacks' as const,
      network: this.config.network === 'devnet' ? 'testnet' : this.config.network,
      filters: {
        events: [
          {
            type: 'contract_call' as const,
            contract_identifier: `${this.config.contractAddress}.multbox`,
            function_name: 'approve-transaction',
          },
        ],
      },
      action: {
        type: 'http_post' as const,
        url: `${this.config.webhookUrl}/approval`,
        authorization_header: this.config.webhookSecret 
          ? `Bearer ${this.config.webhookSecret}` 
          : undefined,
      },
      options: {
        enable_on_registration: true,
        decode_clarity_values: true,
      },
    };

    try {
      const response = await this.client.registerChainhook(hook);
      console.log(`✅ Approval hook registered: ${response.uuid}`);
      return response;
    } catch (error) {
      console.error('❌ Error registering approval hook:', error);
      throw error;
    }
  }

  /**
   * Register a chainhook to monitor transaction executions
   */
  async registerExecutionHook() {
    const hook = {
      version: '1' as const,
      name: `multbox-execution-hook-${this.config.network}`,
      chain: 'stacks' as const,
      network: this.config.network === 'devnet' ? 'testnet' : this.config.network,
      filters: {
        events: [
          {
            type: 'contract_call' as const,
            contract_identifier: `${this.config.contractAddress}.multbox`,
            function_name: 'execute-transaction',
          },
        ],
      },
      action: {
        type: 'http_post' as const,
        url: `${this.config.webhookUrl}/execution`,
        authorization_header: this.config.webhookSecret 
          ? `Bearer ${this.config.webhookSecret}` 
          : undefined,
      },
      options: {
        enable_on_registration: true,
        decode_clarity_values: true,
      },
    };

    try {
      const response = await this.client.registerChainhook(hook);
      console.log(`✅ Execution hook registered: ${response.uuid}`);
      return response;
    } catch (error) {
      console.error('❌ Error registering execution hook:', error);
      throw error;
    }
  }

  /**
   * Register all chainhooks for the multbox contract
   */
  async registerAllHooks() {
    console.log('📡 Registering all chainhooks for multbox contract...\n');
    
    const results = {
      proposal: await this.registerProposalHook(),
      approval: await this.registerApprovalHook(),
      execution: await this.registerExecutionHook(),
    };

    console.log('\n✅ All chainhooks registered successfully!');
    return results;
  }

  /**
   * List all registered chainhooks
   */
  async listHooks() {
    try {
      const response = await this.client.getChainhooks();
      const hooks = response.results;
      console.log(`📋 Found ${hooks.length} registered hook(s):\n`);
      hooks.forEach((hook, index) => {
        console.log(`${index + 1}. ${hook.definition.name} (${hook.uuid})`);
        console.log(`   Network: ${hook.definition.network}`);
        console.log(`   Status: ${hook.status.status}\n`);
      });
      return hooks;
    } catch (error) {
      console.error('❌ Error listing hooks:', error);
      throw error;
    }
  }

  /**
   * Get a specific chainhook by UUID
   */
  async getHook(uuid: string) {
    try {
      const hook = await this.client.getChainhook(uuid);
      return hook;
    } catch (error) {
      console.error('❌ Error getting hook:', error);
      throw error;
    }
  }

  /**
   * Delete a chainhook by UUID
   */
  async deleteHook(uuid: string) {
    try {
      await this.client.deleteChainhook(uuid);
      console.log(`✅ Hook deleted: ${uuid}`);
    } catch (error) {
      console.error('❌ Error deleting hook:', error);
      throw error;
    }
  }

  /**
   * Delete all multbox-related chainhooks
   */
  async deleteAllHooks() {
    try {
      const response = await this.client.getChainhooks();
      const multboxHooks = response.results.filter(h => 
        h.definition.name.includes('multbox') && 
        h.definition.network === (this.config.network === 'devnet' ? 'testnet' : this.config.network)
      );

      if (multboxHooks.length === 0) {
        console.log('ℹ️  No multbox hooks found to delete');
        return;
      }

      console.log(`🗑️  Deleting ${multboxHooks.length} hook(s)...\n`);
      for (const hook of multboxHooks) {
        await this.deleteHook(hook.uuid);
      }
      console.log('\n✅ All multbox hooks deleted successfully!');
    } catch (error) {
      console.error('❌ Error deleting hooks:', error);
      throw error;
    }
  }
}

