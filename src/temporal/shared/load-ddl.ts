// Activity: Creating transactions table in ClickHouse
import { createClient } from '@clickhouse/client';
import { getClickHouseUrl } from '../../config.ts';

/**
 * Executes SQL query with error handling
 */
async function executeQuery(
  clickhouseClient: ReturnType<typeof createClient>,
  query: string,
  description: string
): Promise<void> {
  console.log(`📊 Executing SQL: ${description}`);
  console.log(`   ${query}`);
  
  try {
    await clickhouseClient.exec({
      query: query,
    });
    console.log(`✅ SQL executed successfully`);
  } catch (error: any) {
    // Ignore errors like "already exists" or "index already exists"
    if (error.message && (
      error.message.includes('already exists') ||
      error.message.includes('Index') && error.message.includes('already exists')
    )) {
      console.log(`  ⚠️  Skipped (already exists)`);
    } else {
      console.error(`❌ Error executing SQL:`, error.message);
      throw error;
    }
  }
}

/**
 * Creates debridge database and usdc_transactions table
 */
export async function createTransactionsTable(): Promise<void> {
  const clickhouseClient = createClient({
    host: getClickHouseUrl(),
  });
  
  try {
    // 1. Create database
    await executeQuery(
      clickhouseClient,
      'CREATE DATABASE IF NOT EXISTS debridge',
      'Creating database debridge'
    );
    
    // Small delay for synchronization
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 2. Create table
    await executeQuery(
      clickhouseClient,
      `CREATE TABLE IF NOT EXISTS debridge.usdc_transactions (
        block_number UInt64,
        transaction_hash String,
        from_address String,
        to_address String,
        value String,
        timestamp DateTime,
        receipt_block_hash String,
        receipt_block_number UInt64,
        receipt_contract_address Nullable(String),
        receipt_cumulative_gas_used UInt64,
        receipt_effective_gas_price String,
        receipt_from String,
        receipt_gas_used UInt64,
        receipt_logs_bloom String,
        receipt_status String,
        receipt_to Nullable(String),
        receipt_transaction_index UInt32,
        receipt_type String,
        receipt_logs String,
        updated_at DateTime DEFAULT now()
      ) ENGINE = ReplacingMergeTree(updated_at)
      ORDER BY (transaction_hash, block_number)
      PARTITION BY intDiv(block_number, 100000)
      SETTINGS index_granularity = 8192`,
      'Creating table debridge.usdc_transactions'
    );
    
    // 3. Create indexes
    await executeQuery(
      clickhouseClient,
      'ALTER TABLE debridge.usdc_transactions ADD INDEX IF NOT EXISTS idx_timestamp timestamp TYPE minmax GRANULARITY 4',
      'Creating index idx_timestamp'
    );
    
    await executeQuery(
      clickhouseClient,
      'ALTER TABLE debridge.usdc_transactions ADD INDEX IF NOT EXISTS idx_from_address from_address TYPE bloom_filter GRANULARITY 1',
      'Creating index idx_from_address'
    );
    
    await executeQuery(
      clickhouseClient,
      'ALTER TABLE debridge.usdc_transactions ADD INDEX IF NOT EXISTS idx_to_address to_address TYPE bloom_filter GRANULARITY 1',
      'Creating index idx_to_address'
    );
    
    await executeQuery(
      clickhouseClient,
      'ALTER TABLE debridge.usdc_transactions ADD INDEX IF NOT EXISTS idx_block_number block_number TYPE minmax GRANULARITY 4',
      'Creating index idx_block_number'
    );
    
    console.log(`✅ All DDL queries executed successfully`);
    
  } catch (error) {
    console.error(`❌ Error creating table:`, error);
    throw error;
  } finally {
    await clickhouseClient.close();
  }
}

