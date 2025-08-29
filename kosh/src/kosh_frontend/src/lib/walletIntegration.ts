import * as StellarSdk from '@stellar/stellar-sdk';

// Wallet integration for KOSH wallet
// This integrates with the existing KOSH backend for transaction signing

export interface WalletSignResult {
  success: boolean;
  signedXdr?: string;
  error?: string;
  hash?: string;
  explorer_url?: string;
}

// Sign transaction using KOSH backend
export const signAndSubmitTransaction = async (
  xdr: string,
  actor: any,
  network: string = 'testnet'
): Promise<WalletSignResult> => {
  try {
    if (!actor) {
      throw new Error('No actor available for signing');
    }

    const networkType = network === 'mainnet' ? 'mainnet' : 'testnet';
    
    // Use the existing backend signing method
    // This assumes your backend has a method to sign and submit transactions
    const result = await actor.sign_and_submit_transaction(xdr, [networkType]);

    if (result.Ok) {
      const responseData = JSON.parse(result.Ok);
      if (responseData.success) {
        return {
          success: true,
          signedXdr: responseData.signed_xdr,
          hash: responseData.hash,
          explorer_url: responseData.explorer_url
        };
      } else {
        return {
          success: false,
          error: responseData.error || 'Transaction signing failed'
        };
      }
    } else {
      return {
        success: false,
        error: result.Err || 'Transaction signing failed'
      };
    }
  } catch (error) {
    console.error('Error signing transaction:', error);
    return {
      success: false,
      error: `Transaction signing failed: ${error}`
    };
  }
};

// Alternative: Create transaction and let backend handle everything
export const createAndSubmitTrustline = async (
  publicKey: string,
  assetCode: string,
  assetIssuer: string,
  actor: any,
  limit?: string,
  network: string = 'testnet'
): Promise<WalletSignResult> => {
  try {
    if (!actor) {
      throw new Error('No actor available');
    }

    const networkType = network === 'mainnet' ? 'mainnet' : 'testnet';
    
    // Try to use a backend method that creates and submits trustline
    // This is more likely to exist in your current backend
    const result = await actor.create_and_submit_trustline(
      assetCode,
      assetIssuer,
      limit ? [limit] : [],
      [networkType]
    );

    if (result.Ok) {
      const responseData = JSON.parse(result.Ok);
      if (responseData.success) {
        return {
          success: true,
          hash: responseData.hash,
          explorer_url: responseData.explorer_url
        };
      } else {
        return {
          success: false,
          error: responseData.error || 'Trustline creation failed'
        };
      }
    } else {
      return {
        success: false,
        error: result.Err || 'Trustline creation failed'
      };
    }
  } catch (error) {
    console.error('Error creating trustline:', error);
    return {
      success: false,
      error: `Trustline creation failed: ${error}`
    };
  }
};

// Fallback: Browser wallet integration (Freighter, Albedo, etc.)
export const signWithBrowserWallet = async (
  xdr: string,
  network: string = 'testnet'
): Promise<WalletSignResult> => {
  try {
    // Check if Freighter is available
    if (typeof window !== 'undefined' && (window as any).freighter) {
      const freighter = (window as any).freighter;
      
      const networkPassphrase = network === 'mainnet' 
        ? StellarSdk.Networks.PUBLIC 
        : StellarSdk.Networks.TESTNET;
      
      const signedXdr = await freighter.signTransaction(xdr, {
        network: networkPassphrase,
        accountToSign: undefined // Let user choose
      });

      return {
        success: true,
        signedXdr
      };
    }
    
    // Add other wallet integrations here (Albedo, WalletConnect, etc.)
    
    throw new Error('No browser wallet found. Please install Freighter or another Stellar wallet.');
  } catch (error) {
    console.error('Error signing with browser wallet:', error);
    return {
      success: false,
      error: `Browser wallet signing failed: ${error}`
    };
  }
};

// Submit signed transaction to Stellar network
export const submitSignedTransaction = async (
  signedXdr: string,
  network: string = 'testnet'
): Promise<WalletSignResult> => {
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
