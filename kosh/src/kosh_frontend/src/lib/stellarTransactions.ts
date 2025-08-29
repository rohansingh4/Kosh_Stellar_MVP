import { StellarToken, SwapTransaction } from "../types/stellar";

// Transaction building functions for path payments
// Note: These would typically use Stellar SDK, but for now we'll structure the data
// to be sent to the backend canister for actual transaction building and signing

export interface PathPaymentStrictSendParams {
  source: string;
  sourceAsset: string | { code: string; issuer: string };
  sourceAmount: string;
  destination: string;
  destinationAsset: string | { code: string; issuer: string };
  destinationAmount: string; // minimum amount to receive
  memo?: string;
  path?: Array<{ code: string; issuer: string }>;
}

export interface PathPaymentStrictReceiveParams {
  source: string;
  sourceAsset: string | { code: string; issuer: string };
  sourceAmount: string; // maximum amount to send
  destination: string;
  destinationAsset: string | { code: string; issuer: string };
  destinationAmount: string;
  memo?: string;
  path?: Array<{ code: string; issuer: string }>;
}

export interface TrustlineParams {
  asset: { code: string; issuer: string };
  limit?: string;
}

// Create path payment strict send transaction parameters
export const createPathPaymentStrictSendTransaction = async ({
  source,
  sourceAsset,
  sourceAmount,
  destination,
  destinationAsset,
  destinationAmount,
  memo,
  path = []
}: PathPaymentStrictSendParams) => {
  // Format assets for backend
  const formatAsset = (asset: string | { code: string; issuer: string }) => {
    if (typeof asset === 'string') {
      if (asset === 'native' || asset === 'XLM') {
        return { type: 'native' };
      }
      // Parse "CODE:ISSUER" format
      const parts = asset.split(':');
      if (parts.length === 2) {
        return {
          type: parts[0].length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12',
          code: parts[0],
          issuer: parts[1]
        };
      }
    } else {
      return {
        type: asset.code.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12',
        code: asset.code,
        issuer: asset.issuer
      };
    }
    return { type: 'native' };
  };

  return {
    type: 'pathPaymentStrictSend',
    params: {
      source,
      sendAsset: formatAsset(sourceAsset),
      sendAmount: sourceAmount,
      destination,
      destAsset: formatAsset(destinationAsset),
      destMin: destinationAmount,
      path: path.map(p => formatAsset(p)),
      memo
    }
  };
};

// Create path payment strict receive transaction parameters
export const createPathPaymentStrictReceiveTransaction = async ({
  source,
  sourceAsset,
  sourceAmount,
  destination,
  destinationAsset,
  destinationAmount,
  memo,
  path = []
}: PathPaymentStrictReceiveParams) => {
  const formatAsset = (asset: string | { code: string; issuer: string }) => {
    if (typeof asset === 'string') {
      if (asset === 'native' || asset === 'XLM') {
        return { type: 'native' };
      }
      const parts = asset.split(':');
      if (parts.length === 2) {
        return {
          type: parts[0].length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12',
          code: parts[0],
          issuer: parts[1]
        };
      }
    } else {
      return {
        type: asset.code.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12',
        code: asset.code,
        issuer: asset.issuer
      };
    }
    return { type: 'native' };
  };

  return {
    type: 'pathPaymentStrictReceive',
    params: {
      source,
      sendAsset: formatAsset(sourceAsset),
      sendMax: sourceAmount,
      destination,
      destAsset: formatAsset(destinationAsset),
      destAmount: destinationAmount,
      path: path.map(p => formatAsset(p)),
      memo
    }
  };
};

// Create trustline transaction parameters
export const createTrustlineTransaction = async ({
  asset,
  limit = "922337203685.4775807" // Max limit
}: TrustlineParams) => {
  return {
    type: 'changeTrust',
    params: {
      asset: {
        type: asset.code.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12',
        code: asset.code,
        issuer: asset.issuer
      },
      limit
    }
  };
};

// Helper function to convert stroops to XLM
export const stroopsToXlm = (stroops: string | number): string => {
  const stroopsNum = typeof stroops === 'string' ? parseFloat(stroops) : stroops;
  return (stroopsNum / 10_000_000).toFixed(7);
};

// Helper function to convert XLM to stroops
export const xlmToStroops = (xlm: string | number): string => {
  const xlmNum = typeof xlm === 'string' ? parseFloat(xlm) : xlm;
  return Math.floor(xlmNum * 10_000_000).toString();
};

// Format token for display
export const formatTokenAmount = (amount: string, token?: StellarToken): string => {
  const num = parseFloat(amount);
  if (num === 0) return '0';
  
  // Show more decimals for small amounts
  if (num < 0.001) {
    return num.toFixed(7);
  } else if (num < 1) {
    return num.toFixed(4);
  } else {
    return num.toFixed(2);
  }
};

// Validate Stellar public key format
export const isValidStellarPublicKey = (publicKey: string): boolean => {
  return /^G[A-Z2-7]{55}$/.test(publicKey);
};

// Get network passphrase
export const getNetworkPassphrase = (network: string): string => {
  switch (network) {
    case 'stellar-mainnet':
    case 'mainnet':
      return 'Public Global Stellar Network ; September 2015';
    case 'stellar-testnet':
    case 'testnet':
    default:
      return 'Test SDF Network ; September 2015';
  }
};
