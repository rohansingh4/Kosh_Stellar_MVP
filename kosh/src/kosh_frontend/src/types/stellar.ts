export interface StellarToken {
  name: string;
  address: string;
  symbol: string;
  logoURI: string;
  decimals: number;
  issuer: string;
}

export interface PathPaymentPath {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
}

export interface PathPaymentQuote {
  success: boolean;
  source_amount: string;
  source_asset_type: string;
  source_asset_code?: string;
  source_asset_issuer?: string;
  destination_amount: string;
  destination_asset_type: string;
  destination_asset_code?: string;
  destination_asset_issuer?: string;
  path: PathPaymentPath[];
  error?: string;
}

export interface TrustlineInfo {
  asset_code: string;
  asset_issuer: string;
  balance: string;
  limit: string;
  is_authorized: boolean;
  asset_type: string;
  buying_liabilities: string;
  selling_liabilities: string;
}

export interface TrustlineCheckResult {
  success: boolean;
  exists: boolean;
  trustline?: TrustlineInfo;
  error?: string;
}

export interface SwapTransaction {
  success: boolean;
  hash?: string;
  explorer_url?: string;
  message?: string;
  error?: string;
  transaction_details?: any;
}
