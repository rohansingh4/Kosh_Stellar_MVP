// Stellar Token Swap SDK for KOSH Wallet
// Implements Path Payment Strict Send for token swapping on Stellar mainnet/testnet

import * as StellarSdk from 'stellar-sdk';

// Common Stellar Assets on Mainnet
export const STELLAR_ASSETS = {
  // Native XLM
  XLM: StellarSdk.Asset.native(),
  
  // Stablecoins
  USDC: new StellarSdk.Asset('USDC', 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'),
  USDT: new StellarSdk.Asset('USDT', 'GCQTGZQQ5G4PTM2GL7CDIFKUBIPEC52BROAQIAPW53XBRJVN6ZJVTG6V'),
  EURT: new StellarSdk.Asset('EURT', 'GAP5LETOV6YIE62YAM56STDANPRDO7ZFDBGSNHJQIYGGKSMOZAHOOS2S'),
  
  // Popular tokens
  yXLM: new StellarSdk.Asset('yXLM', 'GARDNV3Q7YGT4AKSDF25LT32YSCCW67G2P2OBKQP5PMPOUF2FIKW7SSP'),
  AQUA: new StellarSdk.Asset('AQUA', 'GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA'),
  SRT: new StellarSdk.Asset('SRT', 'GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B'),
  
  // Wrapped assets
  yUSDC: new StellarSdk.Asset('yUSDC', 'GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF'),
  yBTC: new StellarSdk.Asset('yBTC', 'GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF'),
  yETH: new StellarSdk.Asset('yETH', 'GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF'),
};

export class StellarTokenSwapper {
  constructor(secretKey, network = 'mainnet') {
    this.keypair = StellarSdk.Keypair.fromSecret(secretKey);
    
    // Configure network
    if (network === 'mainnet') {
      this.server = new StellarSdk.Server('https://horizon.stellar.org');
      StellarSdk.Networks.PUBLIC = "Public Global Stellar Network ; September 2015";
      this.networkPassphrase = StellarSdk.Networks.PUBLIC;
    } else {
      this.server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
      StellarSdk.Networks.TESTNET = "Test SDF Network ; September 2015";
      this.networkPassphrase = StellarSdk.Networks.TESTNET;
    }
    
    this.network = network;
    this.publicKey = this.keypair.publicKey();
  }

  /**
   * Find payment paths from XLM to target asset
   * @param {string} destinationAddress - Recipient address
   * @param {StellarSdk.Asset} destinationAsset - Target asset to receive
   * @param {string} sendAmount - Amount of XLM to send
   * @returns {Promise<Array>} Array of payment paths
   */
  async findPaymentPaths(destinationAddress, destinationAsset, sendAmount) {
    try {
      console.log('Finding payment paths...', {
        from: this.publicKey,
        to: destinationAddress,
        sourceAsset: 'XLM',
        destinationAsset: destinationAsset.code,
        sendAmount
      });

      const pathsResponse = await this.server
        .strictSendPaths(STELLAR_ASSETS.XLM, sendAmount, destinationAsset)
        .call();

      console.log('Found paths:', pathsResponse.records);
      return pathsResponse.records;
    } catch (error) {
      console.error('Error finding payment paths:', error);
      throw new Error(`Failed to find payment paths: ${error.message}`);
    }
  }

  /**
   * Execute Path Payment Strict Send to swap XLM to another token
   * @param {string} destinationAddress - Recipient address
   * @param {StellarSdk.Asset} destinationAsset - Asset to receive
   * @param {string} sendAmount - Amount of XLM to send
   * @param {string} destMin - Minimum amount to receive (slippage protection)
   * @param {Array} path - Optional payment path
   * @returns {Promise<Object>} Transaction result
   */
  async swapXLMToToken(destinationAddress, destinationAsset, sendAmount, destMin, path = []) {
    try {
      // Load account
      const account = await this.server.loadAccount(this.publicKey);
      
      // Find optimal path if not provided
      if (path.length === 0) {
        const paths = await this.findPaymentPaths(destinationAddress, destinationAsset, sendAmount);
        if (paths.length > 0) {
          // Use the best path (first one is usually optimal)
          path = paths[0].path || [];
        }
      }

      // Build transaction
      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.networkPassphrase
      })
      .addOperation(
        StellarSdk.Operation.pathPaymentStrictSend({
          sendAsset: STELLAR_ASSETS.XLM,
          sendAmount: sendAmount,
          destination: destinationAddress,
          destAsset: destinationAsset,
          destMin: destMin,
          path: path
        })
      )
      .addMemo(StellarSdk.Memo.text('KOSH Wallet Token Swap'))
      .setTimeout(180)
      .build();

      // Sign transaction
      transaction.sign(this.keypair);

      // Submit transaction
      console.log('Submitting swap transaction...', {
        sendAmount: sendAmount + ' XLM',
        destAsset: destinationAsset.code,
        destMin: destMin,
        pathLength: path.length
      });

      const result = await this.server.submitTransaction(transaction);
      
      console.log('Swap transaction successful:', result);
      
      return {
        success: true,
        hash: result.hash,
        ledger: result.ledger,
        sendAmount: sendAmount + ' XLM',
        destAsset: destinationAsset.code,
        destMin: destMin,
        explorerUrl: this.network === 'mainnet' 
          ? `https://stellar.expert/explorer/public/tx/${result.hash}`
          : `https://stellar.expert/explorer/testnet/tx/${result.hash}`,
        details: result
      };

    } catch (error) {
      console.error('Error executing swap:', error);
      
      // Parse Stellar error for better user feedback
      let errorMessage = 'Swap transaction failed';
      
      if (error.response && error.response.data && error.response.data.extras) {
        const resultCodes = error.response.data.extras.result_codes;
        if (resultCodes && resultCodes.operations) {
          const opError = resultCodes.operations[0];
          switch (opError) {
            case 'op_under_dest_min':
              errorMessage = 'Transaction would result in less than minimum amount. Try increasing slippage tolerance.';
              break;
            case 'op_no_destination':
              errorMessage = 'Destination account does not exist.';
              break;
            case 'op_no_trust':
              errorMessage = 'Destination account does not trust the asset being sent.';
              break;
            case 'op_not_authorized':
              errorMessage = 'Not authorized to send this asset.';
              break;
            case 'op_line_full':
              errorMessage = 'Destination account cannot receive more of this asset.';
              break;
            default:
              errorMessage = `Swap failed: ${opError}`;
          }
        }
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Swap XLM to USDC
   * @param {string} destinationAddress - Recipient address
   * @param {string} xlmAmount - Amount of XLM to send
   * @param {string} minUSDC - Minimum USDC to receive
   * @returns {Promise<Object>} Transaction result
   */
  async swapXLMToUSDC(destinationAddress, xlmAmount, minUSDC) {
    return this.swapXLMToToken(destinationAddress, STELLAR_ASSETS.USDC, xlmAmount, minUSDC);
  }

  /**
   * Swap XLM to USDT
   * @param {string} destinationAddress - Recipient address
   * @param {string} xlmAmount - Amount of XLM to send
   * @param {string} minUSDT - Minimum USDT to receive
   * @returns {Promise<Object>} Transaction result
   */
  async swapXLMToUSDT(destinationAddress, xlmAmount, minUSDT) {
    return this.swapXLMToToken(destinationAddress, STELLAR_ASSETS.USDT, xlmAmount, minUSDT);
  }

  /**
   * Swap XLM to AQUA
   * @param {string} destinationAddress - Recipient address
   * @param {string} xlmAmount - Amount of XLM to send
   * @param {string} minAQUA - Minimum AQUA to receive
   * @returns {Promise<Object>} Transaction result
   */
  async swapXLMToAQUA(destinationAddress, xlmAmount, minAQUA) {
    return this.swapXLMToToken(destinationAddress, STELLAR_ASSETS.AQUA, xlmAmount, minAQUA);
  }

  /**
   * Get quote for swapping XLM to another asset
   * @param {StellarSdk.Asset} destinationAsset - Asset to receive
   * @param {string} sendAmount - Amount of XLM to send
   * @returns {Promise<Object>} Quote information
   */
  async getSwapQuote(destinationAsset, sendAmount) {
    try {
      const paths = await this.server
        .strictSendPaths(STELLAR_ASSETS.XLM, sendAmount, destinationAsset)
        .limit(1)
        .call();

      if (paths.records.length === 0) {
        throw new Error('No swap path available for this asset pair');
      }

      const bestPath = paths.records[0];
      
      return {
        sendAmount: sendAmount + ' XLM',
        receiveAmount: bestPath.destination_amount + ' ' + destinationAsset.code,
        path: bestPath.path,
        sourceAmountXLM: bestPath.source_amount,
        destinationAmount: bestPath.destination_amount,
        rate: (parseFloat(bestPath.destination_amount) / parseFloat(sendAmount)).toFixed(6),
        pathLength: bestPath.path.length
      };

    } catch (error) {
      console.error('Error getting swap quote:', error);
      throw new Error(`Failed to get swap quote: ${error.message}`);
    }
  }

  /**
   * Check if account has trustline for an asset
   * @param {string} accountId - Account to check
   * @param {StellarSdk.Asset} asset - Asset to check
   * @returns {Promise<boolean>} Whether trustline exists
   */
  async hasTrustline(accountId, asset) {
    try {
      const account = await this.server.loadAccount(accountId);
      
      // XLM doesn't need trustline
      if (asset.isNative()) {
        return true;
      }

      return account.balances.some(balance => 
        balance.asset_code === asset.code && 
        balance.asset_issuer === asset.issuer
      );
    } catch (error) {
      console.error('Error checking trustline:', error);
      return false;
    }
  }

  /**
   * Create trustline for an asset
   * @param {StellarSdk.Asset} asset - Asset to create trustline for
   * @param {string} limit - Optional trust limit
   * @returns {Promise<Object>} Transaction result
   */
  async createTrustline(asset, limit = undefined) {
    try {
      const account = await this.server.loadAccount(this.publicKey);
      
      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.networkPassphrase
      })
      .addOperation(
        StellarSdk.Operation.changeTrust({
          asset: asset,
          limit: limit
        })
      )
      .addMemo(StellarSdk.Memo.text('KOSH Wallet Trustline'))
      .setTimeout(180)
      .build();

      transaction.sign(this.keypair);
      const result = await this.server.submitTransaction(transaction);
      
      return {
        success: true,
        hash: result.hash,
        asset: asset.code,
        message: `Trustline created for ${asset.code}`
      };

    } catch (error) {
      console.error('Error creating trustline:', error);
      throw new Error(`Failed to create trustline: ${error.message}`);
    }
  }
}

// Utility functions for the frontend
export const SwapUtils = {
  /**
   * Calculate slippage amount
   * @param {number} amount - Original amount
   * @param {number} slippagePercent - Slippage percentage (e.g., 0.5 for 0.5%)
   * @returns {string} Minimum amount after slippage
   */
  calculateSlippage(amount, slippagePercent) {
    const slippageMultiplier = 1 - (slippagePercent / 100);
    return (amount * slippageMultiplier).toFixed(7);
  },

  /**
   * Format asset for display
   * @param {StellarSdk.Asset} asset - Stellar asset
   * @returns {Object} Formatted asset info
   */
  formatAsset(asset) {
    return {
      code: asset.code,
      issuer: asset.issuer,
      isNative: asset.isNative(),
      display: asset.isNative() ? 'XLM (Native)' : `${asset.code} (${asset.issuer.substring(0, 8)}...)`
    };
  },

  /**
   * Get popular asset pairs for XLM
   * @returns {Array} Array of popular assets to swap to
   */
  getPopularAssets() {
    return [
      { asset: STELLAR_ASSETS.USDC, name: 'USD Coin', symbol: 'USDC' },
      { asset: STELLAR_ASSETS.USDT, name: 'Tether USD', symbol: 'USDT' },
      { asset: STELLAR_ASSETS.AQUA, name: 'Aquarius', symbol: 'AQUA' },
      { asset: STELLAR_ASSETS.yXLM, name: 'yXLM', symbol: 'yXLM' },
      { asset: STELLAR_ASSETS.SRT, name: 'SmartLands', symbol: 'SRT' },
    ];
  }
};

export default StellarTokenSwapper;