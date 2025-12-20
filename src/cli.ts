#!/usr/bin/env node

/**
 * CLI tool for managing chainhooks for the multbox contract
 * 
 * Usage:
 *   npm run chainhooks:register
 *   npm run chainhooks:list
 *   npm run chainhooks:delete <uuid>
 *   npm run chainhooks:delete-all
 */

import { MultboxChainhooks, ChainhookConfig } from './chainhooks.js';
import { readFileSync } from 'fs';
import { join } from 'path';

function loadConfig(): ChainhookConfig {
  // Try to load from environment variables first
  const config: ChainhookConfig = {
    apiKey: process.env.CHAINHOOKS_API_KEY || '',
    network: (process.env.CHAINHOOKS_NETWORK || 'testnet') as 'testnet' | 'mainnet' | 'devnet',
    webhookUrl: process.env.WEBHOOK_URL || 'http://localhost:3000/api/hooks',
    webhookSecret: process.env.WEBHOOK_SECRET,
    contractAddress: process.env.CONTRACT_ADDRESS || '',
  };

  // Try to load from config file
  try {
    const configPath = join(process.cwd(), 'chainhooks.config.json');
    const fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    Object.assign(config, fileConfig);
  } catch (error) {
    // Config file doesn't exist, that's okay
  }

  // Validate required fields
  if (!config.apiKey) {
    console.error('❌ Error: CHAINHOOKS_API_KEY is required');
    console.error('   Set it as an environment variable or in chainhooks.config.json');
    process.exit(1);
  }

  if (!config.contractAddress) {
    console.error('❌ Error: CONTRACT_ADDRESS is required');
    console.error('   Set it as an environment variable or in chainhooks.config.json');
    process.exit(1);
  }

  return config;
}

async function main() {
  const command = process.argv[2];
  const config = loadConfig();
  const chainhooks = new MultboxChainhooks(config);

  try {
    switch (command) {
      case 'register':
      case 'register-all':
        await chainhooks.registerAllHooks();
        break;

      case 'register-proposal':
        await chainhooks.registerProposalHook();
        break;

      case 'register-approval':
        await chainhooks.registerApprovalHook();
        break;

      case 'register-execution':
        await chainhooks.registerExecutionHook();
        break;

      case 'list':
        await chainhooks.listHooks();
        break;

      case 'delete':
        const uuid = process.argv[3];
        if (!uuid) {
          console.error('❌ Error: UUID is required');
          console.error('   Usage: npm run chainhooks:delete <uuid>');
          process.exit(1);
        }
        await chainhooks.deleteHook(uuid);
        break;

      case 'delete-all':
        await chainhooks.deleteAllHooks();
        break;

      default:
        console.log('📡 Multbox Chainhooks CLI\n');
        console.log('Usage:');
        console.log('  npm run chainhooks:register       Register all hooks');
        console.log('  npm run chainhooks:register-proposal   Register proposal hook');
        console.log('  npm run chainhooks:register-approval   Register approval hook');
        console.log('  npm run chainhooks:register-execution   Register execution hook');
        console.log('  npm run chainhooks:list            List all hooks');
        console.log('  npm run chainhooks:delete <uuid>    Delete a hook');
        console.log('  npm run chainhooks:delete-all       Delete all multbox hooks');
        console.log('\nEnvironment variables:');
        console.log('  CHAINHOOKS_API_KEY      Chainhooks API key (required)');
        console.log('  CONTRACT_ADDRESS        Contract address (required)');
        console.log('  CHAINHOOKS_NETWORK      Network: testnet, mainnet, or devnet (default: testnet)');
        console.log('  WEBHOOK_URL            Webhook endpoint URL (default: http://localhost:3000/api/hooks)');
        console.log('  WEBHOOK_SECRET          Optional webhook authorization secret');
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();

