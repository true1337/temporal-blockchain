// Activity: Saving raw transaction data to ClickHouse
import { createClient } from '@clickhouse/client';
import type { TransferEvent } from './types.ts';
import { getClickHouseUrl } from '../../config.ts';

export async function saveToClickHouse(
  events: TransferEvent[],
  tableName: string
): Promise<void> {
  if (events.length === 0) {
    return;
  }
  
  if (!tableName) {
    throw new Error('tableName is required but was not provided');
  }
  
  const clickhouseClient = createClient({
    host: getClickHouseUrl(),
  });
  
  try {
    console.log(`💾 Saving ${events.length} transactions to ClickHouse (table: ${tableName})`);
    
    // Helper function to format Date as string for ClickHouse DateTime64(3)
    // Using toISOString().replace('Z', '') - tested and confirmed working
    const formatDateTime = (date: Date): string => {
      return date.toISOString().replace('Z', '');
    };
    
    // Prepare data for insertion (only fields needed for key and data analysis)
    const values = events.map(e => {
      const timestampStr = formatDateTime(new Date(Number(e.timestamp) * 1000));
      const updatedAtStr = formatDateTime(new Date());
      
      return {
        block_number: Number(e.blockNumber),
        transaction_hash: e.transactionHash,
        from_address: e.from,
        to_address: e.to,
        timestamp: timestampStr,
        receipt_gas_used: Number(e.receipt.gasUsed),
        receipt_effective_gas_price: e.receipt.effectiveGasPrice,
        updated_at: updatedAtStr,
      };
    });
    
    // Log first value to see what's being sent
    if (values.length > 0) {
      console.log(`🔍 Sample JSON being sent: ${JSON.stringify(values[0])}`);
    }
    
    // Insert all data at once
    await clickhouseClient.insert({
      table: tableName,
      values: values,
      format: 'JSONEachRow',
    });
    
    console.log(`✅ Data saved to ClickHouse (${values.length} records)`);
    
  } catch (error) {
    console.error(`❌ Error saving to ClickHouse:`, error);
    throw error;
  } finally {
    await clickhouseClient.close();
  }
}

