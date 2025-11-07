// Конфигурация проекта
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Загружаем переменные окружения из .env файла
config();

type Config = {
  addresses: {
    wallet: string;
    usdcContract: string;
  };
  network: {
    name: string;
    chainId: number;
  };
  temporal: {
    taskQueue: string;
    namespace: string;
  };
  clickhouse: {
    database: string;
  };
};

let cachedConfig: Config | null = null;

/**
 * Загружает конфигурацию из config.json
 */
export function loadConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const configPath = join(process.cwd(), 'config.json');
    const configContent = readFileSync(configPath, 'utf-8');
    cachedConfig = JSON.parse(configContent) as Config;
    return cachedConfig;
  } catch (error) {
    throw new Error(`Ошибка загрузки config.json: ${error}`);
  }
}

/**
 * Получает адрес кошелька из конфига
 */
export function getWalletAddress(): string {
  return loadConfig().addresses.wallet;
}

/**
 * Получает адрес USDC контракта из конфига
 */
export function getUsdcContractAddress(): string {
  return loadConfig().addresses.usdcContract;
}

/**
 * Получает URL Temporal сервера из переменных окружения
 */
export function getTemporalAddress(): string {
  const address = process.env.TEMPORAL_ADDRESS;
  if (!address) {
    throw new Error('TEMPORAL_ADDRESS не установлен в переменных окружения');
  }
  return address;
}

/**
 * Получает URL ClickHouse из переменных окружения
 */
export function getClickHouseUrl(): string {
  const url = process.env.CLICKHOUSE_URL;
  if (!url) {
    throw new Error('CLICKHOUSE_URL не установлен в переменных окружения');
  }
  return url;
}

/**
 * Получает namespace Temporal из конфига
 */
export function getTemporalNamespace(): string {
  return loadConfig().temporal.namespace;
}

/**
 * Получает task queue из конфига
 */
export function getTemporalTaskQueue(): string {
  return loadConfig().temporal.taskQueue;
}

/**
 * Получает имя сети из конфига
 */
export function getNetworkName(): string {
  return loadConfig().network.name;
}

