/**
 * Wrapper for viem PublicClient with automatic retry
 */
import { createPublicClient, http, type PublicClient, type Chain } from 'viem';
import { mainnet } from 'viem/chains';
import { createRetryWrapper, type RetryOptions } from './retry.ts';

/**
 * Wrapper over PublicClient with automatic retry for all methods
 */
class EthereumClientWrapper {
  private client: PublicClient;
  private retryWrapper: <T>(fn: () => Promise<T>) => Promise<T>;

  constructor(
    /** Chain (default mainnet) */
    chain: Chain = mainnet,
    /** RPC endpoint URL (optional, uses default if not specified) */
    rpcUrl?: string,
    /** Options for retry logic */
    retryOptions: RetryOptions = {}
  ) {
    // Create base client
    this.client = createPublicClient({
      chain,
      transport: rpcUrl ? http(rpcUrl) : http(),
    });

    // Create retry wrapper with default settings
    this.retryWrapper = createRetryWrapper({
      maxAttempts: 3,
      initialDelayMs: 1000,
      backoffCoefficient: 2,
      ...retryOptions,
    });
  }

  /**
   * Gets block by number with retry
   */
  async getBlock(args: Parameters<PublicClient['getBlock']>[0]) {
    return this.retryWrapper(() => this.client.getBlock(args));
  }

  /**
   * Gets transaction receipt with retry
   */
  async getTransactionReceipt(args: Parameters<PublicClient['getTransactionReceipt']>[0]) {
    return this.retryWrapper(() => this.client.getTransactionReceipt(args));
  }

  /**
   * Gets event logs with retry
   */
  async getLogs(args: Parameters<PublicClient['getLogs']>[0]) {
    return this.retryWrapper(() => this.client.getLogs(args));
  }

  /**
   * Gets current block number with retry
   */
  async getBlockNumber() {
    return this.retryWrapper(() => this.client.getBlockNumber());
  }

  /**
   * Gets transaction by hash with retry
   */
  async getTransaction(args: Parameters<PublicClient['getTransaction']>[0]) {
    return this.retryWrapper(() => this.client.getTransaction(args));
  }

  /**
   * Gets address balance with retry
   */
  async getBalance(args: Parameters<PublicClient['getBalance']>[0]) {
    return this.retryWrapper(() => this.client.getBalance(args));
  }

  /**
   * Gets contract code with retry
   */
  async getCode(args: Parameters<PublicClient['getCode']>[0]) {
    return this.retryWrapper(() => this.client.getCode(args));
  }

  /**
   * Reads data from contract with retry
   */
  async readContract(args: Parameters<PublicClient['readContract']>[0]) {
    return this.retryWrapper(() => this.client.readContract(args));
  }

  /**
   * Gets access to original client (for methods that are not wrapped)
   */
  get rawClient(): PublicClient {
    return this.client;
  }
}

// Create singleton instance with default settings
let defaultClient: EthereumClientWrapper | null = null;

/**
 * Gets or creates default Ethereum client
 */
export function getEthereumClient(
  chain?: Chain,
  rpcUrl?: string,
  retryOptions?: RetryOptions
): EthereumClientWrapper {
  if (!defaultClient || chain || rpcUrl || retryOptions) {
    defaultClient = new EthereumClientWrapper(chain, rpcUrl, retryOptions);
  }
  return defaultClient;
}

/**
 * Creates a new instance of Ethereum client
 */
export function createEthereumClient(
  chain?: Chain,
  rpcUrl?: string,
  retryOptions?: RetryOptions
): EthereumClientWrapper {
  return new EthereumClientWrapper(chain, rpcUrl, retryOptions);
}

// Export type for convenience
export type { EthereumClientWrapper };

