import * as StellarSdk from '@stellar/stellar-sdk';
import { StellarToken } from '../types/stellar';

// Stellar server configuration
const getStellarServer = (network: string = 'mainnet') => {
  const isMainnet = network === 'mainnet' || network === 'stellar-mainnet';
  const server = new StellarSdk.Horizon.Server(
    isMainnet ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org'
  );
  const networkPassphrase = isMainnet 
    ? StellarSdk.Networks.PUBLIC 
    : StellarSdk.Networks.TESTNET;
  
  return { server, networkPassphrase };
};

// Create path payment transaction (like your friend's implementation)
export const createPathPaymentTransaction = async (
  sourceAddress: string,
  destinationAddress: string,
  sendAmount: string, // XLM amount to send
  destinationToken: StellarToken,
  network: string = 'mainnet'
): Promise<{ xdr: string; networkPassphrase: string }> => {
  const { server, networkPassphrase } = getStellarServer(network);
  
  try {
    // Load the source account
    const account = await server.loadAccount(sourceAddress);
    
    // Create the destination asset
    const destinationAsset = new StellarSdk.Asset(destinationToken.symbol, destinationToken.issuer);
    
    // Build the transaction (similar to your friend's approach)
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.pathPaymentStrictSend({
          sendAsset: StellarSdk.Asset.native(), // Send XLM
          sendAmount: sendAmount,
          destination: destinationAddress,
          destAsset: destinationAsset,
          destMin: "0.0000001", // Minimum possible amount (1 stroop)
        })
      )
      .setTimeout(300) // 5 minutes timeout
      .build();

    return {
      xdr: transaction.toXDR(),
      networkPassphrase
    };
  } catch (error) {
    console.error('Error creating path payment transaction:', error);
    throw new Error(`Failed to create swap transaction: ${error}`);
  }
};

// Submit signed transaction to Stellar network
export const submitSwapTransaction = async (
  signedXdr: string,
  network: string = 'mainnet'
): Promise<{ success: boolean; hash?: string; explorer_url?: string; error?: string; result?: any }> => {
  const { server, networkPassphrase } = getStellarServer(network);
  
  try {
    // Parse the signed transaction
    const transaction = StellarSdk.TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
    
    // Submit to the network
    const result = await server.submitTransaction(transaction);
    
    const isMainnet = network === 'mainnet' || network === 'stellar-mainnet';
    const explorerBase = isMainnet 
      ? 'https://stellar.expert/explorer/public'
      : 'https://stellar.expert/explorer/testnet';
    
    return {
      success: true,
      hash: result.hash,
      explorer_url: `${explorerBase}/tx/${result.hash}`,
      result
    };
  } catch (error: any) {
    console.error('Error submitting swap transaction:', error);
    
    // Parse Stellar error details
    let errorMessage = 'Swap transaction failed';
    let errorDetails = '';
    
    if (error.response?.data) {
      const errorData = error.response.data;
      errorMessage = errorData.title || 'Transaction Failed';
      errorDetails = errorData.detail || '';
      
      // Extract operation result codes
      if (errorData.extras?.result_codes) {
        const codes = errorData.extras.result_codes;
        errorDetails += ` | Transaction: ${codes.transaction || 'unknown'}`;
        if (codes.operations) {
          errorDetails += ` | Operations: ${codes.operations.join(', ')}`;
        }
      }
    }
    
    return {
      success: false,
      error: `${errorMessage}: ${errorDetails}`,
      result: error.response?.data
    };
  }
};

// Complete swap flow with Freighter wallet (like your friend's approach)
export const executeSwapWithFreighter = async (
  sourceAddress: string,
  sendAmount: string,
  destinationToken: StellarToken,
  network: string = 'mainnet'
): Promise<{ success: boolean; hash?: string; explorer_url?: string; error?: string }> => {
  try {
    // Check if Freighter is available
    if (typeof window === 'undefined' || !(window as any).freighter) {
      throw new Error('Freighter wallet not found. Please install Freighter extension.');
    }

    // Create the transaction
    const { xdr, networkPassphrase } = await createPathPaymentTransaction(
      sourceAddress,
      sourceAddress, // Same address for self-swap
      sendAmount,
      destinationToken,
      network
    );

    console.log('Created swap transaction XDR:', xdr);

    // Sign with Freighter
    const freighter = (window as any).freighter;
    const signedXdr = await freighter.signTransaction(xdr, {
      network: networkPassphrase,
    });

    console.log('Transaction signed successfully');

    // Submit to network
    const submitResult = await submitSwapTransaction(signedXdr, network);
    
    return submitResult;
  } catch (error) {
    console.error('Error in swap flow:', error);
    return {
      success: false,
      error: `Swap failed: ${error}`
    };
  }
};

// Fallback: Create XDR for manual signing (if no Freighter)
export const createSwapXdrForSigning = async (
  sourceAddress: string,
  sendAmount: string,
  destinationToken: StellarToken,
  network: string = 'mainnet'
): Promise<{ xdr: string; message: string }> => {
  try {
    const { xdr } = await createPathPaymentTransaction(
      sourceAddress,
      sourceAddress,
      sendAmount,
      destinationToken,
      network
    );

    return {
      xdr,
      message: `Path payment transaction created. Sign this XDR with your Stellar wallet to complete the ${sendAmount} XLM to ${destinationToken.symbol} swap.`
    };
  } catch (error) {
    throw new Error(`Failed to create swap XDR: ${error}`);
  }
};
