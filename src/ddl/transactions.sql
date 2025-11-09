-- Таблица для хранения данных транзакций USDC Transfer
-- Содержит только поля, необходимые для ключа и data analysis
CREATE DATABASE IF NOT EXISTS debridge;
USE debridge;

CREATE TABLE IF NOT EXISTS debridge.usdc_transactions (
  -- Ключевые поля для дедупликации
  block_number UInt64,
  transaction_hash String,
  
  -- Поля для data analysis
  from_address String,
  to_address String,
  timestamp DateTime64(3),
  receipt_gas_used UInt64,
  receipt_effective_gas_price String,
  
  updated_at DateTime64(3) DEFAULT now64()
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

