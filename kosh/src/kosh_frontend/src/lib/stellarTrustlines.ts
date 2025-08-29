import * as StellarSdk from '@stellar/stellar-sdk';
import { StellarToken } from '../types/stellar';

// Get Stellar server and network configuration
const getStellarServer = (network: string = 'testnet') => {
  const isMainnet = network === 'stellar-mainnet' || network === 'mainnet';
  const server = new StellarSdk.Horizon.Server(
    isMainnet ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org'
  );
  const networkPassphrase = isMainnet 
    ? StellarSdk.Networks.PUBLIC 
    : StellarSdk.Networks.TESTNET;
  
  return { server, networkPassphrase };
};

// Create trustline transaction XDR (to be signed by wallet)
export const createTrustlineTransaction = async (
  publicKey: string,
  token: StellarToken,
  limit?: string,
  network: string = 'testnet'
): Promise<{ xdr: string; network: string }> => {
  const { server, networkPassphrase } = getStellarServer(network);
  
  try {
    // Load the account
    const account = await server.loadAccount(publicKey);
    
    // Create the asset
    const asset = new StellarSdk.Asset(token.symbol, token.issuer);
    
    // Build the transaction
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.changeTrust({
          asset,
          limit: limit || undefined, // undefined means max limit
          source: publicKey,
        })
      )
      .setTimeout(300) // 5 minutes
      .build();

    return {
      xdr: transaction.toXDR(),
      network: networkPassphrase
    };
  } catch (error) {
    console.error('Error creating trustline transaction:', error);
    throw new Error(`Failed to create trustline transaction: ${error}`);
  }
};

// Remove trustline transaction XDR (set limit to 0)
export const removeTrustlineTransaction = async (
  publicKey: string,
  token: StellarToken,
  network: string = 'testnet'
): Promise<{ xdr: string; network: string }> => {
  const { server, networkPassphrase } = getStellarServer(network);
  
  try {
    // Load the account
    const account = await server.loadAccount(publicKey);
    
    // Create the asset
    const asset = new StellarSdk.Asset(token.symbol, token.issuer);
    
    // Build the transaction with limit 0 to remove trustline
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.changeTrust({
          asset,
          limit: '0', // Set to 0 to remove trustline
          source: publicKey,
        })
      )
      .setTimeout(300)
      .build();

    return {
      xdr: transaction.toXDR(),
      network: networkPassphrase
    };
  } catch (error) {
    console.error('Error creating remove trustline transaction:', error);
    throw new Error(`Failed to create remove trustline transaction: ${error}`);
  }
};

// Submit signed transaction to the network
export const submitTrustlineTransaction = async (
  signedXdr: string,
  network: string = 'testnet'
): Promise<any> => {
  const { server, networkPassphrase } = getStellarServer(network);
  
  try {
    // Parse the signed transaction
    const transaction = StellarSdk.TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
    
    // Submit to the network
    const result = await server.submitTransaction(transaction);
    
    return {
      success: true,
      hash: result.hash,
      result,
      explorer_url: getExplorerUrl(result.hash, network)
    };
  } catch (error) {
    console.error('Error submitting trustline transaction:', error);
    throw error;
  }
};

// Get explorer URL for transaction
const getExplorerUrl = (hash: string, network: string): string => {
  const isMainnet = network === 'stellar-mainnet' || network === 'mainnet';
  const explorerBase = isMainnet 
    ? 'https://stellar.expert/explorer/public'
    : 'https://stellar.expert/explorer/testnet';
  
  return `${explorerBase}/tx/${hash}`;
};

// Check if account has trustline for a specific asset
export const checkAccountTrustline = async (
  publicKey: string,
  token: StellarToken,
  network: string = 'testnet'
): Promise<{ exists: boolean; balance?: string; limit?: string }> => {
  const { server } = getStellarServer(network);
  
  try {
    const account = await server.loadAccount(publicKey);
    
    // Find the trustline for this asset
    const trustline = account.balances.find(balance => 
      balance.asset_type !== 'native' && 
      'asset_code' in balance &&
      'asset_issuer' in balance &&
      balance.asset_code === token.symbol && 
      balance.asset_issuer === token.issuer
    );
    
    if (trustline && 'limit' in trustline) {
      return {
        exists: true,
        balance: trustline.balance,
        limit: trustline.limit
      };
    }
    
    return { exists: false };
  } catch (error) {
    if (error instanceof StellarSdk.NotFoundError) {
      return { exists: false };
    }
    throw error;
  }
};
