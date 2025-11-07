// Activity: Fetching Transfer events from Ethereum
import type { TransferEvent, FetchEventsParams } from './types.ts';
import { getEthereumClient } from '../shared/ethereum-client.ts';


/**
 * Generates block ranges with given step (like Python range)
 */
function* blockRanges(
  fromBlock: bigint,
  toBlock: bigint,
  step: bigint = 1000n
): Generator<[bigint, bigint], void, unknown> {
  let current = fromBlock;
  while (current < toBlock) {
    const end = current + step - 1n;
    const actualEnd = end > toBlock ? toBlock : end;
    yield [current, actualEnd];
    current = actualEnd + 1n;
  }
}

export async function fetchTransferEvents(
  params: FetchEventsParams
): Promise<TransferEvent[]> {
  // Initialize client with automatic retry
  const ethereumClient = getEthereumClient();
  const eventAbi = params.eventAbi;
  
  // Convert string back to bigint
  const fromBlock = BigInt(params.fromBlock);
  const toBlock = BigInt(params.toBlock);
  
  console.log(`📡 Fetching events from blocks ${fromBlock.toString()} - ${toBlock.toString()}`);
  
  // RPC limit: maximum 1000 blocks per request
  const RPC_MAX_BLOCKS = 1000n;
  const allEvents: TransferEvent[] = [];
  
  // Generate ranges of 1000 blocks (like Python range)
  for (const [batchFrom, batchTo] of blockRanges(fromBlock, toBlock, RPC_MAX_BLOCKS)) {
    console.log(`  📦 Batch: blocks ${batchFrom.toString()} - ${batchTo.toString()}`);
    
    try {
      const batchEvents = await fetchEventsForRange(
        batchFrom,
        batchTo,
        params,
        ethereumClient,
        eventAbi
      );
      
      allEvents.push(...batchEvents);
      
      // Delay between batches to avoid rate limiting (increased)
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds between batches
      
    } catch (error) {
      console.error(`❌ Error in batch ${batchFrom.toString()}-${batchTo.toString()}:`, error);
      // Continue with next batch
    }
  }
  
  console.log(`✅ Total events fetched: ${allEvents.length}`);
  return allEvents;
}

/**
 * Fetches events for a block range (up to 1000 blocks)
 */
async function fetchEventsForRange(
  fromBlock: bigint,
  toBlock: bigint,
  params: FetchEventsParams,
  ethereumClient: ReturnType<typeof import('../shared/ethereum-client.ts').getEthereumClient>,
  eventAbi: FetchEventsParams['eventAbi']
): Promise<TransferEvent[]> {
  // Small delay before requests to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Get events where address was sender
  const logsFrom = await ethereumClient.getLogs({
    address: params.usdcContractAddress as `0x${string}`,
    event: eventAbi,
    args: {
      from: params.walletAddress as `0x${string}`,
    },
    fromBlock,
    toBlock,
  });
  
  // Delay between requests
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Get events where address was receiver
  const logsTo = await ethereumClient.getLogs({
    address: params.usdcContractAddress as `0x${string}`,
    event: eventAbi,
    args: {
      to: params.walletAddress as `0x${string}`,
    },
    fromBlock,
    toBlock,
  });
  
  // Merge and deduplicate (there may be overlap)
  const allLogs = [...logsFrom, ...logsTo];
  const uniqueLogs = Array.from(
    new Map(allLogs.map(log => [log.transactionHash, log])).values()
  );
  
  // Convert to required format
  const events: TransferEvent[] = [];
  
  for (const log of uniqueLogs) {
    try {
      // Get block information for timestamp (with automatic retry)
      const block = await ethereumClient.getBlock({ blockNumber: log.blockNumber! });
      
      // Get transaction receipt with automatic retry
      let receipt;
      try {
        receipt = await ethereumClient.getTransactionReceipt({ hash: log.transactionHash! });
      } catch (receiptError: any) {
        // If receipt not found after all retries, skip this event
        if (receiptError.message && receiptError.message.includes('Transaction receipt') && receiptError.message.includes('could not be found')) {
          console.warn(`⚠️  Receipt not found for transaction ${log.transactionHash} after all retries, skipping event`);
          continue;
        }
        throw receiptError;
      }
      
      events.push({
        blockNumber: log.blockNumber!.toString(), // bigint -> string
        transactionHash: String(log.transactionHash!),
        from: String((log as any).args?.from || ''),
        to: String((log as any).args?.to || ''),
        value: ((log as any).args?.value || 0n).toString(), // bigint -> string
        timestamp: Number(block.timestamp),
        receipt: {
          blockHash: receipt.blockHash,
          blockNumber: receipt.blockNumber.toString(),
          contractAddress: receipt.contractAddress || null,
          cumulativeGasUsed: receipt.cumulativeGasUsed.toString(),
          effectiveGasPrice: receipt.effectiveGasPrice ? receipt.effectiveGasPrice.toString() : '0',
          from: receipt.from,
          gasUsed: receipt.gasUsed.toString(),
          logs: receipt.logs.map(log => ({
            address: log.address,
            topics: log.topics,
            data: log.data,
            logIndex: log.logIndex.toString(),
            blockNumber: log.blockNumber.toString(),
            blockHash: log.blockHash,
            transactionHash: log.transactionHash,
            transactionIndex: log.transactionIndex.toString(),
          })),
          logsBloom: receipt.logsBloom,
          status: receipt.status,
          to: receipt.to || null,
          transactionHash: receipt.transactionHash,
          transactionIndex: receipt.transactionIndex.toString(),
          type: receipt.type,
        },
      });
    } catch (error: any) {
      // If error getting block or other data, log and skip
      console.warn(`⚠️  Error processing event ${log.transactionHash}:`, error.message);
      continue;
    }
  }
  
  console.log(`✅ Fetched ${events.length} events`);
  return events;
}


