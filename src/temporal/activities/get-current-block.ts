// Activity: Getting current block number
import { getEthereumClient } from '../shared/ethereum-client.ts';

/**
 * Gets current block number in Ethereum network
 */
export async function getCurrentBlock(): Promise<string> {
  const ethereumClient = getEthereumClient();
  const blockNumber = await ethereumClient.getBlockNumber();
  return blockNumber.toString();
}

