// Common types for activities

// In Temporal all values must be JSON-serializable
// bigint is passed as string
export type TransferEvent = {
  blockNumber: string; // bigint as string for serialization
  transactionHash: string;
  from: string;
  to: string;
  value: string; // bigint as string
  timestamp: number;
  // Fields from TransactionReceipt
  receipt: {
    blockHash: string;
    blockNumber: string;
    contractAddress: string | null;
    cumulativeGasUsed: string;
    effectiveGasPrice: string;
    from: string;
    gasUsed: string;
    logs: Array<{
      address: string;
      topics: string[];
      data: string;
      logIndex: string;
      blockNumber: string;
      blockHash: string;
      transactionHash: string;
      transactionIndex: string;
    }>;
    logsBloom: string;
    status: string;
    to: string | null;
    transactionHash: string;
    transactionIndex: string;
    type: string;
  };
};

export type FetchEventsParams = {
  walletAddress: string;
  usdcContractAddress: string;
  fromBlock: string; // bigint is passed as string
  toBlock: string;  // bigint is passed as string
  eventAbi: import('viem').AbiEvent; // Event ABI
  tableName: string; // ClickHouse table name
};

