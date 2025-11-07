// Activity: Managing block processing state
import { createClient } from '@clickhouse/client';
import { getClickHouseUrl } from '../../config.ts';

/**
 * Creates a table for storing block processing state
 */
export async function createStateTable(): Promise<void> {
  const clickhouseClient = createClient({
    host: getClickHouseUrl(),
  });
  
  try {
    // Create debridge database if it doesn't exist
    await clickhouseClient.exec({
      query: 'CREATE DATABASE IF NOT EXISTS debridge',
    });
    
    // Small delay for synchronization
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Create state table
    await clickhouseClient.exec({
      query: `
        CREATE TABLE IF NOT EXISTS debridge.processing_state (
          wallet_address String,
          last_processed_block UInt64,
          updated_at DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(updated_at)
        ORDER BY wallet_address
        SETTINGS index_granularity = 8192
      `,
    });
    
    console.log('✅ Table processing_state created successfully');
    
  } catch (error) {
    console.error('❌ Error creating table processing_state:', error);
    throw error;
  } finally {
    await clickhouseClient.close();
  }
}

/**
 * Gets the last processed block for an address
 */
export async function getLastProcessedBlock(walletAddress: string): Promise<string | null> {
  const clickhouseClient = createClient({
    host: getClickHouseUrl(),
  });
  
  try {
    const result = await clickhouseClient.query({
      query: `
        SELECT last_processed_block
        FROM debridge.processing_state
        FINAL
        WHERE wallet_address = {walletAddress:String}
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      query_params: {
        walletAddress,
      },
      format: 'JSON',
    });
    
    const data = await result.json() as Array<{ last_processed_block: bigint }>;
    
    if (data && data.length > 0) {
      return data[0].last_processed_block.toString();
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error getting last processed block:', error);
    throw error;
  } finally {
    await clickhouseClient.close();
  }
}

/**
 * Saves the last processed block for an address
 */
export async function saveLastProcessedBlock(
  walletAddress: string,
  blockNumber: string
): Promise<void> {
  const clickhouseClient = createClient({
    host: getClickHouseUrl(),
  });
  
  try {
    await clickhouseClient.insert({
      table: 'debridge.processing_state',
      values: [{
        wallet_address: walletAddress,
        last_processed_block: BigInt(blockNumber),
        updated_at: new Date(),
      }],
      format: 'JSONEachRow',
    });
    
    console.log(`✅ Saved last processed block ${blockNumber} for address ${walletAddress}`);
  } catch (error) {
    console.error('❌ Error saving last processed block:', error);
    throw error;
  } finally {
    await clickhouseClient.close();
  }
}

