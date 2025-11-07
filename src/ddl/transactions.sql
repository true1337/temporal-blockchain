-- Таблица для хранения сырых данных транзакций USDC Transfer
CREATE DATABASE IF NOT EXISTS debridge;
USE debridge;

CREATE TABLE IF NOT EXISTS debridge.usdc_transactions (
  block_number UInt64,
  transaction_hash String,
  from_address String,
  to_address String,
  value String,
  timestamp DateTime,
  
  -- Поля из TransactionReceipt
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
  
  -- Массив логов (JSON строка для хранения)
  receipt_logs String,
  
  updated_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (transaction_hash, block_number)
PARTITION BY toYYYYMM(timestamp)
SETTINGS index_granularity = 8192;

-- Индексы для эффективных запросов
ALTER TABLE debridge.usdc_transactions 
ADD INDEX IF NOT EXISTS idx_timestamp timestamp TYPE minmax GRANULARITY 4;

ALTER TABLE debridge.usdc_transactions 
ADD INDEX IF NOT EXISTS idx_from_address from_address TYPE bloom_filter GRANULARITY 1;

ALTER TABLE debridge.usdc_transactions 
ADD INDEX IF NOT EXISTS idx_to_address to_address TYPE bloom_filter GRANULARITY 1;

ALTER TABLE debridge.usdc_transactions 
ADD INDEX IF NOT EXISTS idx_block_number block_number TYPE minmax GRANULARITY 4;

