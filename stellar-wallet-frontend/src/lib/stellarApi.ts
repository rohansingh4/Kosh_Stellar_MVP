// Stellar API functions - moved from backend for better performance and scalability

export interface StellarConfig {
  network: 'testnet' | 'mainnet';
  horizonUrl?: string;
}

export interface AccountBalance {
  balance: string;
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  buying_liabilities: string;
  selling_liabilities: string;
  limit?: string;
  is_authorized?: boolean;
}

export interface AccountInfo {
  id: string;
  sequence: string;
  balances: AccountBalance[];
  thresholds: {
    low_threshold: number;
    med_threshold: number;
    high_threshold: number;
  };
  flags: {
    auth_required: boolean;
    auth_revocable: boolean;
    auth_immutable: boolean;
    auth_clawback_enabled: boolean;
  };
}

export interface SwapQuote {
  success: boolean;
  send_amount?: string;
  receive_amount?: string;
  rate?: number;
  path?: any;
  source_amount?: string;
  destination_amount?: string;
  error?: string;
}

// Get Stellar network configuration
export const getStellarConfig = (network: string): StellarConfig => {
  const isMainnet = network === 'stellar-mainnet' || network === 'mainnet';
  return {
    network: isMainnet ? 'mainnet' : 'testnet',
    horizonUrl: isMainnet ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org'
  };
};

// Fetch account balance directly from Stellar Horizon API
export const getAccountBalance = async (address: string, network: string = 'testnet'): Promise<string> => {
  const config = getStellarConfig(network);
  const url = `${config.horizonUrl}/accounts/${address}`;

  try {
    const response = await fetch(url);
    
    if (response.status === 404) {
      return "Account needs funding";
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const account: AccountInfo = await response.json();
    
    // Find the native XLM balance
    const xlmBalance = account.balances.find(balance => balance.asset_type === 'native');
    
    if (xlmBalance) {
      return `${xlmBalance.balance} XLM`;
    }
    
    return "No XLM balance found";
  } catch (error) {
    console.error('Failed to fetch account balance:', error);
    throw new Error(`Failed to fetch balance: ${error}`);
  }
};

// Fetch all account assets/balances
export const getAccountAssets = async (address: string, network: string = 'testnet'): Promise<{
  success: boolean;
  address: string;
  assets: AccountBalance[];
  network: string;
  error?: string;
}> => {
  const config = getStellarConfig(network);
  const url = `${config.horizonUrl}/accounts/${address}`;

  try {
    const response = await fetch(url);
    
    if (response.status === 404) {
      return {
        success: false,
        error: "Account not found",
        address,
        assets: [],
        network: config.network
      };
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const account: AccountInfo = await response.json();
    
    // Format assets with additional info
    const assets = account.balances.map(balance => {
      if (balance.asset_type === 'native') {
        return {
          ...balance,
          asset_code: 'XLM',
          asset_issuer: null as any
        };
      }
      return balance;
    });

    return {
      success: true,
      address,
      assets,
      network: config.network
    };
  } catch (error) {
    console.error('Failed to fetch account assets:', error);
    return {
      success: false,
      error: `Failed to fetch assets: ${error}`,
      address,
      assets: [],
      network: config.network
    };
  }
};

// Get swap quote from Stellar DEX
export const getSwapQuote = async (
  destinationAssetCode: string,
  destinationAssetIssuer: string,
  sendAmount: string,
  network: string = 'testnet'
): Promise<SwapQuote> => {
  const config = getStellarConfig(network);
  
  // Use Stellar DEX path finding
  const url = `${config.horizonUrl}/paths/strict-send?source_asset_type=native&source_amount=${sendAmount}&destination_assets=${destinationAssetCode}:${destinationAssetIssuer}`;

  try {
    console.log('Fetching swap quote from URL:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const paths = await response.json();
    
    if (paths._embedded?.records && paths._embedded.records.length > 0) {
      const bestPath = paths._embedded.records[0];
      
      return {
        success: true,
        send_amount: `${sendAmount} XLM`,
        receive_amount: `${bestPath.destination_amount} ${destinationAssetCode}`,
        rate: parseFloat(bestPath.destination_amount) / parseFloat(sendAmount),
        path: bestPath.path,
        source_amount: bestPath.source_amount,
        destination_amount: bestPath.destination_amount
      };
    }

    return {
      success: false,
      error: "No swap path available for this asset pair"
    };
  } catch (error) {
    console.error('Failed to get swap quote:', error);
    return {
      success: false,
      error: `Failed to get swap quote: ${error}`
    };
  }
};

// Check if a trustline exists for a specific asset
export const checkTrustline = async (
  address: string,
  assetCode: string,
  assetIssuer: string,
  network: string = 'testnet'
): Promise<{
  success: boolean;
  exists: boolean;
  trustline?: AccountBalance;
  error?: string;
}> => {
  try {
    const assetsResult = await getAccountAssets(address, network);
    
    if (!assetsResult.success) {
      return {
        success: false,
        exists: false,
        error: assetsResult.error
      };
    }

    const trustline = assetsResult.assets.find(asset => 
      asset.asset_code === assetCode && asset.asset_issuer === assetIssuer
    );

    if (trustline) {
      return {
        success: true,
        exists: true,
        trustline: {
          asset_code: assetCode,
          asset_issuer: assetIssuer,
          balance: trustline.balance,
          limit: trustline.limit,
          is_authorized: trustline.is_authorized,
          asset_type: trustline.asset_type,
          buying_liabilities: trustline.buying_liabilities,
          selling_liabilities: trustline.selling_liabilities
        }
      };
    }

    // Check against popular assets as fallback
    const popularAssets = [
      { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
      { code: "USDT", issuer: "GCQTGZQQ5G4PTM2GL7CDIFKUBIPEC52BROAQIAPW53XBRJVN6ZJVTG6V" },
      { code: "AQUA", issuer: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA" },
      { code: "yXLM", issuer: "GARDNV3Q7YGT4AKSDF25LT32YSCCW67UUQG7QKYJLXPJDCYXVKWR7QLU" }
    ];

    const isPopular = popularAssets.some(asset => 
      asset.code === assetCode && asset.issuer === assetIssuer
    );

    return {
      success: true,
      exists: false,
      error: isPopular ? undefined : "Asset not found in popular assets list"
    };
  } catch (error) {
    console.error('Failed to check trustline:', error);
    return {
      success: false,
      exists: false,
      error: `Failed to check trustline: ${error}`
    };
  }
};

// Get account sequence number (used by backend for transaction building)
export const getSequenceNumber = async (address: string, network: string = 'testnet'): Promise<number> => {
  const config = getStellarConfig(network);
  const url = `${config.horizonUrl}/accounts/${address}`;

  try {
    const response = await fetch(url);
    
    if (response.status === 404) {
      throw new Error("Account not found - please fund the account first");
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const account: AccountInfo = await response.json();
    return parseInt(account.sequence, 10);
  } catch (error) {
    console.error('Failed to fetch sequence number:', error);
    throw error;
  }
};

// Utility: Format network name for display
export const formatNetworkName = (network: string): string => {
  switch (network) {
    case 'stellar-mainnet':
    case 'mainnet':
      return 'Stellar Mainnet';
    case 'stellar-testnet':
    case 'testnet':
    default:
      return 'Stellar Testnet';
  }
};

// Utility: Get explorer URL for transactions
export const getExplorerUrl = (hash: string, network: string): string => {
  const config = getStellarConfig(network);
  const explorerBase = config.network === 'mainnet' 
    ? 'https://stellar.expert/explorer/public'
    : 'https://stellar.expert/explorer/testnet';
  
  return `${explorerBase}/tx/${hash}`;
};
