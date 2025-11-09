// Temporal Client - starts workflow
import { Connection, Client } from '@temporalio/client';
import { exportTransferEventsWorkflow } from './workflow.ts';
import { 
  getTemporalAddress, 
  getTemporalTaskQueue, 
  getTemporalNamespace,
  getWalletAddress,
  getUsdcContractAddress,
  getInitialFromBlock,
  getBatchSize
} from '../config.ts';

async function startWorkflow() {
  // Connect to Temporal
  const temporalAddress = getTemporalAddress();
  const connection = await Connection.connect({
    channelArgs:{
      "grpc.max_receive_message_length": 100 * 1024 * 1024, // 100MB
      "grpc.max_send_message_length": 100 * 1024 * 1024, // 100MB
    },
    address: temporalAddress,
  });

  const client = new Client({ connection });

  // Export parameters from config
  const walletAddress = getWalletAddress();
  const usdcContractAddress = getUsdcContractAddress();
  const taskQueue = getTemporalTaskQueue();
  const namespace = getTemporalNamespace();

  const params = {
    walletAddress,
    usdcContractAddress,
    initialFromBlock: getInitialFromBlock(), // Initial block for first run (from config.json)
    batchSize: getBatchSize(), // Batch size from config.json
  };

  console.log('🚀 Starting Transfer events export workflow...');
  console.log('Parameters:', params);

  // Start workflow with ID that includes block range
  // Format: usdc-export-{walletAddress}-{fromBlock}
  const initialBlock = params.initialFromBlock;
  const workflowId = `usdc-export-${walletAddress}-${initialBlock}`;
  const handle = await client.workflow.start(exportTransferEventsWorkflow, {
    args: [params],
    taskQueue,
    workflowId,
    workflowIdReusePolicy: 'ALLOW_DUPLICATE', // Allow duplicates for continue-as-new
  });

  console.log(`✅ Workflow started. ID: ${handle.workflowId}`);
  console.log(`📊 Temporal Address: ${temporalAddress}`);
  console.log(`📊 Namespace: ${namespace}`);
  console.log(`🔄 Workflow runs infinitely. Use Temporal UI for monitoring.`);

  // Don't wait for completion as workflow is infinite
  // Close connection
  await connection.close();
}

startWorkflow().catch(console.error);

