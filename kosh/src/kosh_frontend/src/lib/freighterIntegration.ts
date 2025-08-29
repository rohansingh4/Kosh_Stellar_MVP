import * as StellarSdk from '@stellar/stellar-sdk';

declare global {
  interface Window {
    freighter?: {
      isConnected(): Promise<boolean>;
      getPublicKey(): Promise<string>;
      signTransaction(xdr: string, options?: { network?: string; accountToSign?: string }): Promise<string>;
    };
  }
}

// Check if Freighter wallet is available
export const isFreighterAvailable = (): boolean => {
  return typeof window !== 'undefined' && !!window.freighter;
};

// Check if Freighter is connected
export const isFreighterConnected = async (): Promise<boolean> => {
  if (!isFreighterAvailable()) return false;
  
  try {
    return await window.freighter!.isConnected();
  } catch (error) {
    console.error('Error checking Freighter connection:', error);
    return false;
  }
};

// Get public key from Freighter
export const getFreighterPublicKey = async (): Promise<string | null> => {
  if (!isFreighterAvailable()) return null;
  
  try {
    return await window.freighter!.getPublicKey();
  } catch (error) {
    console.error('Error getting Freighter public key:', error);
    return null;
  }
};

// Sign transaction with Freighter
export const signWithFreighter = async (
  xdr: string,
  network: string = 'testnet'
): Promise<{ success: boolean; signedXdr?: string; error?: string }> => {
  if (!isFreighterAvailable()) {
    return {
      success: false,
      error: 'Freighter wallet not found. Please install Freighter extension.'
    };
  }

  try {
    const networkPassphrase = network === 'mainnet' 
      ? StellarSdk.Networks.PUBLIC 
      : StellarSdk.Networks.TESTNET;

    const signedXdr = await window.freighter!.signTransaction(xdr, {
      network: networkPassphrase
    });

    return {
      success: true,
      signedXdr
    };
  } catch (error) {
    console.error('Error signing with Freighter:', error);
    return {
      success: false,
      error: `Freighter signing failed: ${error}`
    };
  }
};

// Submit signed transaction to Stellar network
export const submitSignedTransaction = async (
  signedXdr: string,
  network: string = 'testnet'
): Promise<{ success: boolean; hash?: string; explorer_url?: string; error?: string }> => {
  try {
    const isMainnet = network === 'mainnet';
    const server = new StellarSdk.Horizon.Server(
      isMainnet ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org'
    );
    const networkPassphrase = isMainnet 
      ? StellarSdk.Networks.PUBLIC 
      : StellarSdk.Networks.TESTNET;

    const transaction = StellarSdk.TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
    const result = await server.submitTransaction(transaction);

    const explorerBase = isMainnet 
      ? 'https://stellar.expert/explorer/public'
      : 'https://stellar.expert/explorer/testnet';
    
    return {
      success: true,
      hash: result.hash,
      explorer_url: `${explorerBase}/tx/${result.hash}`
    };
  } catch (error) {
    console.error('Error submitting transaction:', error);
    return {
      success: false,
      error: `Transaction submission failed: ${error}`
    };
  }
};

// Complete trustline creation flow with Freighter
export const createTrustlineWithFreighter = async (
  xdr: string,
  network: string = 'testnet'
): Promise<{ success: boolean; hash?: string; explorer_url?: string; error?: string }> => {
  try {
    // Sign with Freighter
    const signResult = await signWithFreighter(xdr, network);
    
    if (!signResult.success) {
      return {
        success: false,
        error: signResult.error
      };
    }

    // Submit to network
    const submitResult = await submitSignedTransaction(signResult.signedXdr!, network);
    
    return submitResult;
  } catch (error) {
    console.error('Error in trustline creation flow:', error);
    return {
      success: false,
      error: `Trustline creation failed: ${error}`
    };
  }
};
