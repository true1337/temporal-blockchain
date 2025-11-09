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
    console.log(`💾 Saving ${events.length} transactions to ClickHouse`);
    // Prepare data for insertion (only fields needed for key and data analysis)
    const values = events.map(e => ({
      block_number: Number(e.blockNumber),
      transaction_hash: e.transactionHash,
      from_address: e.from,
      to_address: e.to,
      timestamp: new Date(Number(e.timestamp) * 1000),
      receipt_gas_used: Number(e.receipt.gasUsed),
      receipt_effective_gas_price: e.receipt.effectiveGasPrice,
      updated_at: new Date(),
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
    
    console.log(`✅ Data saved to ClickHouse (${values.length} records)`);
    
  } catch (error) {
    console.error(`❌ Error saving to ClickHouse:`, error);
    throw error;
  } finally {
    await clickhouseClient.close();
  }
}

