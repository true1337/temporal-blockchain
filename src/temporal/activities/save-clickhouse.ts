// Activity: Saving raw transaction data to ClickHouse
import { createClient } from '@clickhouse/client';
import type { TransferEvent } from './types.ts';
import { getClickHouseUrl } from '../../config.ts';

export async function saveToClickHouse(
  events: TransferEvent[]
): Promise<void> {
  if (events.length === 0) {
    return;
  }
  
  const clickhouseClient = createClient({
    host: getClickHouseUrl(),
  });
  
  try {
    console.log(`💾 Saving ${events.length} raw transactions to ClickHouse`);
    // ReplacingMergeTree automatically deduplicates by ORDER BY (transaction_hash, block_number)
    // during merge operations, so DELETE is not required
    // Prepare data for insertion (all fields from receipt)
    const values = events.map(e => ({
      block_number: Number(e.blockNumber),
      transaction_hash: e.transactionHash,
      from_address: e.from,
      to_address: e.to,
      value: e.value,
      timestamp: new Date(Number(e.timestamp) * 1000),
      
      // Fields from receipt
      receipt_block_hash: e.receipt.blockHash,
      receipt_block_number: Number(e.receipt.blockNumber),
      receipt_contract_address: e.receipt.contractAddress,
      receipt_cumulative_gas_used: Number(e.receipt.cumulativeGasUsed),
      receipt_effective_gas_price: e.receipt.effectiveGasPrice,
      receipt_from: e.receipt.from,
      receipt_gas_used: Number(e.receipt.gasUsed),
      receipt_logs_bloom: e.receipt.logsBloom,
      receipt_status: e.receipt.status,
      receipt_to: e.receipt.to,
      receipt_transaction_index: Number(e.receipt.transactionIndex),
      receipt_type: e.receipt.type,
      receipt_logs: JSON.stringify(e.receipt.logs), // Logs as JSON string
    }));
    
    // Insert data in batches for efficiency
    const insertChunkSize = 1000;
    for (let i = 0; i < values.length; i += insertChunkSize) {
      const chunk = values.slice(i, i + insertChunkSize);
      console.log(`📊 INSERT INTO debridge.usdc_transactions (${chunk.length} records)`);
      await clickhouseClient.insert({
        table: 'debridge.usdc_transactions',
        values: chunk,
        format: 'JSONEachRow',
      });
    }
    
    console.log(`✅ Raw data saved to ClickHouse (${values.length} records)`);
    console.log(`ℹ️  Using ReplacingMergeTree - deduplication will occur automatically during merge`);
    
  } catch (error) {
    console.error(`❌ Error saving to ClickHouse:`, error);
    throw error;
  } finally {
    await clickhouseClient.close();
  }
}

