import { PathPaymentQuote, StellarToken } from "../types/stellar";

// Stellar Horizon API configuration
const getStellarConfig = (network: string = 'testnet') => {
  const isMainnet = network === 'stellar-mainnet' || network === 'mainnet';
  return {
    network: isMainnet ? 'mainnet' : 'testnet',
    horizonUrl: isMainnet ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org'
  };
};

// Find strict send paths (specify source amount)
export const findStrictSendPaths = async ({
  sourceAsset = 'native',
  sourceAmount,
  destinationPublicKey,
  destinationAsset,
  network = 'testnet'
}: {
  sourceAsset?: string;
  sourceAmount: string;
  destinationPublicKey: string;
  destinationAsset: string;
  network?: string;
}): Promise<PathPaymentQuote[]> => {
  const config = getStellarConfig(network);
  
  // Parse destination asset
  let destAssetType = 'native';
  let destAssetCode = '';
  let destAssetIssuer = '';
  
  if (destinationAsset !== 'native') {
    const parts = destinationAsset.split(':');
    if (parts.length === 2) {
      destAssetType = 'credit_alphanum4';
      destAssetCode = parts[0];
      destAssetIssuer = parts[1];
      
      if (destAssetCode.length > 4) {
        destAssetType = 'credit_alphanum12';
      }
    }
  }

  // Build destination assets parameter
  const destAssetParam = destAssetType === 'native' 
    ? 'native' 
    : `${destAssetCode}:${destAssetIssuer}`;

  const url = `${config.horizonUrl}/paths/strict-send?` +
    `source_asset_type=${sourceAsset === 'native' ? 'native' : 'credit_alphanum4'}&` +
    `source_amount=${sourceAmount}&` +
    `destination_account=${destinationPublicKey}&` +
    `destination_assets=${destAssetParam}`;

  try {
    console.log('Finding strict send paths:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data._embedded?.records) {
      return data._embedded.records.map((record: any) => ({
        success: true,
        source_amount: record.source_amount,
        source_asset_type: record.source_asset_type,
        source_asset_code: record.source_asset_code,
        source_asset_issuer: record.source_asset_issuer,
        destination_amount: record.destination_amount,
        destination_asset_type: record.destination_asset_type,
        destination_asset_code: record.destination_asset_code,
        destination_asset_issuer: record.destination_asset_issuer,
        path: record.path || []
      }));
    }

    return [];
  } catch (error) {
    console.error('Error finding strict send paths:', error);
    return [{
      success: false,
      error: `Failed to find paths: ${error}`,
      source_amount: sourceAmount,
      source_asset_type: 'native',
      destination_amount: '0',
      destination_asset_type: destAssetType,
      destination_asset_code: destAssetCode,
      destination_asset_issuer: destAssetIssuer,
      path: []
    }];
  }
};

// Find strict receive paths (specify destination amount)
export const findStrictReceivePaths = async ({
  sourcePublicKey,
  destinationAsset,
  destinationAmount,
  sourceAsset = 'native',
  network = 'testnet'
}: {
  sourcePublicKey: string;
  destinationAsset: string;
  destinationAmount: string;
  sourceAsset?: string;
  network?: string;
}): Promise<PathPaymentQuote[]> => {
  const config = getStellarConfig(network);
  
  // Parse destination asset
  let destAssetType = 'native';
  let destAssetCode = '';
  let destAssetIssuer = '';
  
  if (destinationAsset !== 'native') {
    const parts = destinationAsset.split(':');
    if (parts.length === 2) {
      destAssetType = 'credit_alphanum4';
      destAssetCode = parts[0];
      destAssetIssuer = parts[1];
      
      if (destAssetCode.length > 4) {
        destAssetType = 'credit_alphanum12';
      }
    }
  }

  // Build source assets parameter
  const sourceAssetParam = sourceAsset === 'native' ? 'native' : sourceAsset;

  const url = `${config.horizonUrl}/paths/strict-receive?` +
    `source_account=${sourcePublicKey}&` +
    `source_assets=${sourceAssetParam}&` +
    `destination_asset_type=${destAssetType}&` +
    `destination_asset_code=${destAssetCode}&` +
    `destination_asset_issuer=${destAssetIssuer}&` +
    `destination_amount=${destinationAmount}`;

  try {
    console.log('Finding strict receive paths:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data._embedded?.records) {
      return data._embedded.records.map((record: any) => ({
        success: true,
        source_amount: record.source_amount,
        source_asset_type: record.source_asset_type,
        source_asset_code: record.source_asset_code,
        source_asset_issuer: record.source_asset_issuer,
        destination_amount: record.destination_amount,
        destination_asset_type: record.destination_asset_type,
        destination_asset_code: record.destination_asset_code,
        destination_asset_issuer: record.destination_asset_issuer,
        path: record.path || []
      }));
    }

    return [];
  } catch (error) {
    console.error('Error finding strict receive paths:', error);
    return [{
      success: false,
      error: `Failed to find paths: ${error}`,
      source_amount: '0',
      source_asset_type: 'native',
      destination_amount: destinationAmount,
      destination_asset_type: destAssetType,
      destination_asset_code: destAssetCode,
      destination_asset_issuer: destAssetIssuer,
      path: []
    }];
  }
};

// Get simple quote for XLM to token swap using Horizon paths API directly
export const getSimpleSwapQuote = async (
  token: StellarToken,
  xlmAmount: string,
  network: string = 'testnet'
): Promise<PathPaymentQuote | null> => {
  try {
    const config = getStellarConfig(network);
    const destinationAsset = `${token.symbol}:${token.issuer}`;
    
    // Use Horizon paths API directly for quotes
    const url = `${config.horizonUrl}/paths/strict-send?` +
      `source_asset_type=native&` +
      `source_amount=${xlmAmount}&` +
      `destination_assets=${destinationAsset}`;

    console.log('Getting quote from:', url);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data._embedded?.records && data._embedded.records.length > 0) {
      const bestPath = data._embedded.records[0];
      
      return {
        success: true,
        source_amount: bestPath.source_amount,
        source_asset_type: 'native',
        destination_amount: bestPath.destination_amount,
        destination_asset_type: bestPath.destination_asset_type,
        destination_asset_code: bestPath.destination_asset_code,
        destination_asset_issuer: bestPath.destination_asset_issuer,
        path: bestPath.path || []
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting simple swap quote:', error);
    return null;
  }
};

// Format asset for Stellar SDK
export const formatAssetForStellar = (assetCode: string, assetIssuer?: string) => {
  if (assetCode === 'XLM' || assetCode === 'native') {
    return { type: 'native' };
  }
  
  return {
    type: assetCode.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12',
    code: assetCode,
    issuer: assetIssuer
  };
};

// Calculate slippage amount
export const calculateSlippage = (amount: string, slippagePercent: number): string => {
  const numAmount = parseFloat(amount);
  const slippageAmount = numAmount * (slippagePercent / 100);
  return (numAmount - slippageAmount).toFixed(7);
};

// Calculate maximum amount with slippage (for strict receive)
export const calculateMaxAmount = (amount: string, slippagePercent: number): string => {
  const numAmount = parseFloat(amount);
  const slippageAmount = numAmount * (slippagePercent / 100);
  return (numAmount + slippageAmount).toFixed(7);
};
