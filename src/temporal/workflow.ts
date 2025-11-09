// Temporal Workflow - orchestrates the export process
import { proxyActivities, sleep, continueAsNew } from '@temporalio/workflow';
import { parseAbiItem } from 'viem';
import * as activities from './activities/index.ts';

// Register activities with different timeouts
// Fast activities (DDL)
const {
  createTransactionsTable,
  getCurrentBlock
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

// Slow activities (fetching events - saves to ClickHouse internally)
const {
  fetchTransferEvents
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 hour', // Increased for processing large batches
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

// Type for workflow parameters
export type TransferExportParams = {
  walletAddress: string;
  usdcContractAddress: string;
  lastProcessedBlock?: string; // Last processed block (deterministic state from workflow)
  initialFromBlock?: string; // Initial block for first run (fallback if lastProcessedBlock not provided)
  batchSize?: number; // Batch size of blocks to process (default 5000)
  tableName: string; // ClickHouse table name
};

// Main infinite workflow
export async function exportTransferEventsWorkflow(
  params: TransferExportParams
): Promise<void> {
  
  console.log(`🚀 Starting infinite Transfer events export for address ${params.walletAddress}`);
  
  // Create tables (once at the beginning)
  await createTransactionsTable();
  
  // Use deterministic workflow state (from parameters) - no DB reads needed
  // This ensures idempotency - workflow always knows exact state from its history
  let lastProcessedBlock: string;
  
  if (params.lastProcessedBlock) {
    // Use state from workflow parameters (deterministic)
    lastProcessedBlock = params.lastProcessedBlock;
    console.log(`📌 Using deterministic state: block ${lastProcessedBlock}`);
  } else if (params.initialFromBlock) {
    // First run: use initialFromBlock
    lastProcessedBlock = params.initialFromBlock;
    console.log(`📌 First run: starting from block ${lastProcessedBlock}`);
  } else {
    throw new Error('Either lastProcessedBlock or initialFromBlock must be provided');
  }
  
  let currentBlock = BigInt(lastProcessedBlock);
  const batchSize = BigInt(params.batchSize || 5000);
  let iteration = 0;
  
  // Infinite loop for processing new blocks
  while (true) {
    iteration++;
    
    // Get current network block
    const latestBlock = BigInt(await getCurrentBlock());
    
    // If there are new blocks to process
    if (currentBlock < latestBlock) {
      const batchToBlock = currentBlock + batchSize;
      const actualToBlock = batchToBlock > latestBlock ? latestBlock : batchToBlock;
      
      console.log(`📦 Iteration ${iteration}: processing blocks ${currentBlock.toString()} - ${actualToBlock.toString()}`);
      
      try {
        // Fetch events for this batch and save them directly to ClickHouse
        // Events are saved incrementally inside fetchTransferEvents to avoid Temporal 4MB limit
        const eventAbi = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');
        const eventsCount = await fetchTransferEvents({
          walletAddress: params.walletAddress,
          usdcContractAddress: params.usdcContractAddress,
          fromBlock: currentBlock.toString(),
          toBlock: actualToBlock.toString(),
          eventAbi,
          tableName: params.tableName,
        });
        
        if (eventsCount > 0) {
          console.log(`✅ Processed ${eventsCount} events from blocks ${currentBlock.toString()} - ${actualToBlock.toString()}`);
        }
        
        // Update progress (deterministic state - no DB write needed)
        currentBlock = actualToBlock;
        console.log(`✅ Progress updated: last processed block ${currentBlock.toString()}`);
        
      } catch (error) {
        console.error(`❌ Error in batch ${currentBlock.toString()}-${actualToBlock.toString()}:`, error);
        // Continue working, don't stop on error
      }
    } else {
      console.log(`⏳ No new blocks. Current: ${currentBlock.toString()}, Latest: ${latestBlock.toString()}`);
    }
    
    // Continue-as-new every iteration (to avoid accumulating history)
    // Pass lastProcessedBlock as deterministic state (not initialFromBlock)
    // Note: workflowId cannot be changed in continueAsNew, it remains the same from initial start
    // The workflowId includes the initial block: usdc-export-{walletAddress}-{initialBlock}
    console.log(`🔄 Executing continue-as-new after iteration ${iteration}`);
    console.log(`📊 Current block range: ${currentBlock.toString()} (last processed)`);
    
    await continueAsNew<typeof exportTransferEventsWorkflow>({
      ...params,
      lastProcessedBlock: currentBlock.toString(), // Deterministic state
      // Remove initialFromBlock after first run - it's no longer needed
      initialFromBlock: undefined,
    });
    return;
  }
}

