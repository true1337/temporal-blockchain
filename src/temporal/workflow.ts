// Temporal Workflow - orchestrates the export process
import { proxyActivities, sleep, continueAsNew } from '@temporalio/workflow';
import { parseAbiItem } from 'viem';
import * as activities from './activities/index.ts';

// Register activities with different timeouts
// Fast activities (DDL, state)
const {
  createTransactionsTable,
  createStateTable,
  getLastProcessedBlock,
  saveLastProcessedBlock,
  getCurrentBlock
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

// Slow activities (fetching events, saving)
const {
  fetchTransferEvents,
  saveToClickHouse
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
  initialFromBlock?: string; // Initial block for first run (optional)
  batchSize?: number; // Batch size of blocks to process (default 10000)
};

// Main infinite workflow
export async function exportTransferEventsWorkflow(
  params: TransferExportParams
): Promise<void> {
  
  console.log(`🚀 Starting infinite Transfer events export for address ${params.walletAddress}`);
  
  // Create tables (once at the beginning)
  await createTransactionsTable();
  await createStateTable();
  
  // Get last processed block or use initialFromBlock
  let lastProcessedBlock = await getLastProcessedBlock(params.walletAddress);
  if (!lastProcessedBlock && params.initialFromBlock) {
    lastProcessedBlock = params.initialFromBlock;
  }
  if (!lastProcessedBlock) {
    throw new Error('initialFromBlock is not specified and no saved state found');
  }
  
  let currentBlock = BigInt(lastProcessedBlock);
  const batchSize = BigInt(params.batchSize || 10000);
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
        // Fetch events for this batch
        const eventAbi = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');
        const events = await fetchTransferEvents({
          walletAddress: params.walletAddress,
          usdcContractAddress: params.usdcContractAddress,
          fromBlock: currentBlock.toString(),
          toBlock: actualToBlock.toString(),
          eventAbi,
        });
        
        if (events.length > 0) {
          // Save raw data to ClickHouse in smaller batches to avoid Temporal message size limits (4MB default)
          // ReplacingMergeTree automatically deduplicates by (transaction_hash, block_number)
          const saveBatchSize = 500; // Save 500 events at a time to stay under message size limit
          for (let i = 0; i < events.length; i += saveBatchSize) {
            const batch = events.slice(i, i + saveBatchSize);
            await saveToClickHouse(batch);
          }
          console.log(`✅ Processed ${events.length} events from blocks ${currentBlock.toString()} - ${actualToBlock.toString()}`);
        }
        
        // Save progress
        currentBlock = actualToBlock;
        await saveLastProcessedBlock(params.walletAddress, currentBlock.toString());
        console.log(`💾 Progress saved: last processed block ${currentBlock.toString()}`);
        
      } catch (error) {
        console.error(`❌ Error in batch ${currentBlock.toString()}-${actualToBlock.toString()}:`, error);
        // Continue working, don't stop on error
      }
    } else {
      console.log(`⏳ No new blocks. Current: ${currentBlock.toString()}, Latest: ${latestBlock.toString()}`);
    }
    
    // Continue-as-new every iteration (to avoid accumulating history)
    console.log(`🔄 Executing continue-as-new after iteration ${iteration}`);
    await continueAsNew<typeof exportTransferEventsWorkflow>({
      ...params,
      initialFromBlock: currentBlock.toString(),
    });
    return;
  }
}

