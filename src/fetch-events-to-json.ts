// Простой скрипт для получения Transfer событий и сохранения в JSON файл
import { createPublicClient, http, parseAbiItem } from 'viem';
import { mainnet } from 'viem/chains';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { getWalletAddress, getUsdcContractAddress } from './config';

// Конфигурация из config.json
const wallet_address = getWalletAddress();
const usdc_contract_address = getUsdcContractAddress();

// Инициализация клиента
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(), // использует встроенные эндпоинты
});

const eventAbi = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

type TransferEvent = {
  blockNumber: string;
  transactionHash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  // Поля из TransactionReceipt
  receipt: {
    blockHash: string;
    blockNumber: string;
    contractAddress: string | null;
    cumulativeGasUsed: string;
    effectiveGasPrice: string;
    from: string;
    gasUsed: string;
    logs: any[];
    logsBloom: string;
    status: string;
    to: string | null;
    transactionHash: string;
    transactionIndex: string;
    type: string;
  };
};

// Максимальный размер батча (RPC ограничение обычно 1000 блоков)
const BATCH_SIZE = 1000n;

async function fetchTransferEventsBatch(
  walletAddress: string,
  usdcContractAddress: string,
  fromBlock: bigint,
  toBlock: bigint
): Promise<TransferEvent[]> {
  try {
    // Получаем события где адрес был отправителем
    const logsFrom = await publicClient.getLogs({
      address: usdcContractAddress as `0x${string}`,
      event: eventAbi,
      args: {
        from: walletAddress as `0x${string}`,
      },
      fromBlock,
      toBlock,
    });
    
    // Получаем события где адрес был получателем
    const logsTo = await publicClient.getLogs({
      address: usdcContractAddress as `0x${string}`,
      event: eventAbi,
      args: {
        to: walletAddress as `0x${string}`,
      },
      fromBlock,
      toBlock,
    });
    
    // Объединяем и дедуплицируем
    const allLogs = [...logsFrom, ...logsTo];
    const uniqueLogs = Array.from(
      new Map(allLogs.map(log => [log.transactionHash, log])).values()
    );
    
    // Преобразуем в нужный формат
    const events: TransferEvent[] = [];
    
    for (const log of uniqueLogs) {
      // Получаем информацию о блоке для timestamp
      const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
      
      // Получаем квитанцию транзакции (receipt)
      const receipt = await publicClient.getTransactionReceipt({ hash: log.transactionHash });
      
      // Создаем объект только с нужными полями
      const event: TransferEvent = {
        blockNumber: log.blockNumber.toString(),
        transactionHash: String(log.transactionHash),
        from: String(log.args.from || ''),
        to: String(log.args.to || ''),
        value: (log.args.value || 0n).toString(),
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
      };
      
      events.push(event);
    }
    
    return events;
    
  } catch (error) {
    console.error(`❌ Ошибка при получении событий из блоков ${fromBlock}-${toBlock}:`, error);
    throw error;
  }
}

async function fetchTransferEvents(
  walletAddress: string,
  usdcContractAddress: string,
  fromBlock: bigint,
  toBlock: bigint
): Promise<TransferEvent[]> {
  const totalBlocks = toBlock - fromBlock + 1n;
  console.log(`📡 Получение событий из блоков ${fromBlock} - ${toBlock} (${totalBlocks} блоков)`);
  
  // Разбиваем на батчи по 1000 блоков
  const allEvents: TransferEvent[] = [];
  let currentFrom = fromBlock;
  let batchNumber = 1;
  const totalBatches = Number((totalBlocks + BATCH_SIZE - 1n) / BATCH_SIZE);
  
  while (currentFrom <= toBlock) {
    const currentTo = currentFrom + BATCH_SIZE - 1n > toBlock 
      ? toBlock 
      : currentFrom + BATCH_SIZE - 1n;
    
    console.log(`  Батч ${batchNumber}/${totalBatches}: блоки ${currentFrom} - ${currentTo}`);
    
    const batchEvents = await fetchTransferEventsBatch(
      walletAddress,
      usdcContractAddress,
      currentFrom,
      currentTo
    );
    
    allEvents.push(...batchEvents);
    console.log(`    Найдено ${batchEvents.length} событий в этом батче`);
    
    currentFrom = currentTo + 1n;
    batchNumber++;
    
    // Небольшая задержка между батчами, чтобы не перегружать RPC
    if (currentFrom <= toBlock) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Финальная дедупликация (на случай пересечений между батчами)
  const uniqueEvents = Array.from(
    new Map(allEvents.map(event => [event.transactionHash, event])).values()
  );
  
  console.log(`✅ Всего получено ${uniqueEvents.length} уникальных событий`);
  return uniqueEvents;
}

async function saveToJsonFile(events: TransferEvent[], filename: string = 'transfer-events.json'): Promise<void> {
  const filePath = join(process.cwd(), filename);
  
  const data = {
    metadata: {
      totalEvents: events.length,
      walletAddress: wallet_address,
      usdcContractAddress: usdc_contract_address,
      exportedAt: new Date().toISOString(),
    },
    events,
  };
  
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`💾 Сохранено ${events.length} событий в файл: ${filePath}`);
}

async function main() {
  console.log('🚀 Начало получения Transfer событий...\n');
  console.log(`Адрес кошелька: ${wallet_address}`);
  console.log(`Контракт USDC: ${usdc_contract_address}\n`);
  
  try {
    // Получаем текущий блок
    const currentBlock = await publicClient.getBlockNumber();
    console.log(`Текущий блок: ${currentBlock}`);
    
    // Настройки диапазона блоков
    // Можно изменить эти параметры
    const fromBlock = currentBlock - 2000n; // Последние 2k блоков (2 батча по 1000)
    const toBlock = currentBlock;
    
    console.log(`Ищем события с блока ${fromBlock} до ${toBlock}\n`);
    
    // Получаем события
    const events = await fetchTransferEvents(
      wallet_address,
      usdc_contract_address,
      fromBlock,
      toBlock
    );
    
    // Сохраняем в JSON файл
    if (events.length > 0) {
      // Выводим первое событие для проверки
      console.log('\n📋 Пример первого события:');
      console.log(JSON.stringify(events[0], null, 2));
      console.log('\n');
      
      await saveToJsonFile(events);
      console.log(`\n✅ Готово! Найдено ${events.length} событий`);
    } else {
      console.log('\n⚠️ События не найдены. Попробуйте увеличить диапазон блоков.');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

// Запуск
main();

