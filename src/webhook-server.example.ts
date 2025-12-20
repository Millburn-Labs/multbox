/**
 * Example webhook server for receiving chainhook events
 * 
 * This is a basic Express.js server example that receives
 * chainhook events from the multbox contract.
 * 
 * To use this:
 * 1. Install express: npm install express @types/express
 * 2. Run: npx tsx src/webhook-server.example.ts
 * 3. Update your chainhooks config to point to this server
 */

import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// Middleware to verify webhook secret (optional)
const verifySecret = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    return next(); // No secret configured, skip verification
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

// Proposal webhook endpoint
app.post('/api/hooks/proposal', verifySecret, (req, res) => {
  console.log('📝 Transaction Proposal Event:');
  console.log(JSON.stringify(req.body, null, 2));
  
  // Extract relevant data
  const { apply } = req.body;
  if (apply && apply.length > 0) {
    const transaction = apply[0].transactions[0];
    const contractCall = transaction.contract_call;
    
    if (contractCall) {
      const args = contractCall.function_args || [];
      console.log(`   Contract: ${contractCall.contract_id}`);
      console.log(`   Method: ${contractCall.function_name}`);
      console.log(`   Arguments:`, args);
    }
  }

  res.json({ received: true });
});

// Approval webhook endpoint
app.post('/api/hooks/approval', verifySecret, (req, res) => {
  console.log('✅ Transaction Approval Event:');
  console.log(JSON.stringify(req.body, null, 2));
  
  // Extract relevant data
  const { apply } = req.body;
  if (apply && apply.length > 0) {
    const transaction = apply[0].transactions[0];
    const contractCall = transaction.contract_call;
    
    if (contractCall) {
      const args = contractCall.function_args || [];
      console.log(`   Contract: ${contractCall.contract_id}`);
      console.log(`   Method: ${contractCall.function_name}`);
      console.log(`   Transaction ID:`, args[0]?.repr);
    }
  }

  res.json({ received: true });
});

// Execution webhook endpoint
app.post('/api/hooks/execution', verifySecret, (req, res) => {
  console.log('🚀 Transaction Execution Event:');
  console.log(JSON.stringify(req.body, null, 2));
  
  // Extract relevant data
  const { apply } = req.body;
  if (apply && apply.length > 0) {
    const transaction = apply[0].transactions[0];
    const contractCall = transaction.contract_call;
    
    if (contractCall) {
      const args = contractCall.function_args || [];
      console.log(`   Contract: ${contractCall.contract_id}`);
      console.log(`   Method: ${contractCall.function_name}`);
      console.log(`   Transaction ID:`, args[0]?.repr);
    }
  }

  res.json({ received: true });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'multbox-webhook-server' });
});

app.listen(PORT, () => {
  console.log(`🚀 Webhook server running on http://localhost:${PORT}`);
  console.log(`📡 Listening for chainhook events...`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /api/hooks/proposal  - Transaction proposals`);
  console.log(`  POST /api/hooks/approval  - Transaction approvals`);
  console.log(`  POST /api/hooks/execution - Transaction executions`);
  console.log(`  GET  /health              - Health check\n`);
});

