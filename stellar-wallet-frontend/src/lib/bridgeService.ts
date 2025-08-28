// Bridge service for cross-chain token locking and bridging
// Based on Stellar Soroban smart contracts

import {
  TransactionBuilder,
  Account,
  Contract,
  BASE_FEE,
  nativeToScVal,
  Address,
  Networks,
  Transaction
} from '@stellar/stellar-sdk';

import { Actor } from '../types/backend';

interface BridgeParams {
  userAddress: string;
  fromToken: string;
  destToken: string;
  amount: number;
  destChain: string;
  recipientAddress: string;
}

interface BridgeConfig {
  contractId: string;
  network: string;
  rpcUrl: string;
  networkPassphrase: string;
}

interface AccountData {
  sequence: string;
  balances: any[];
}

interface BridgeResult {
  success: boolean;
  hash: string;
  message: string;
  explorer_url: string;
  contractDetails?: {
    contractId: string;
    sequenceNumber: string;
    network: string;
    userAddress: string;
    transactionXDR?: string;
  };
  bridgeDetails: {
    fromChain: string;
    toChain: string;
    amount: string;
    token: string;
    recipient: string;
    contractExecution?: boolean;
  };
}

interface TransactionBuildResult {
  transaction: Transaction;
  transactionXDR: string;
  contractCall: {
    contractId: string;
    method: string;
    parameters: {
      user: string;
      fromToken: string;
      destToken: string;
      amount: number;
      destChain: string;
      recipientAddress: string;
    };
  };
  networkConfig: {
    network: string;
    networkPassphrase: string;
    rpcUrl: string;
  };
}

// Get bridge configuration based on network
export const getBridgeConfig = (network: string): BridgeConfig => {
  const isTestnet = network !== 'stellar-mainnet';
  
  return {
    contractId: 'CDTA5IYGUGRI4PAGXJL7TPBEIC3EZY6V23ILF5EDVXFXLCGGMVOK4CRL',
    network: isTestnet ? 'testnet' : 'mainnet',
    rpcUrl: isTestnet ? 'https://soroban-testnet.stellar.org' : 'https://soroban-mainnet.stellar.org',
    networkPassphrase: isTestnet ? 'Test SDF Network ; September 2015' : 'Public Global Stellar Network ; September 2015'
  };
};

// Get destination chain name from chain ID
export const getChainName = (chainId: string): string => {
  const chainNames: Record<string, string> = {
    '17000': 'Holsky Testnet'
  };
  
  return chainNames[chainId] || `Chain ${chainId}`;
};

// Validate bridge parameters
export const validateBridgeParams = (params: BridgeParams): string | null => {
  if (!params.userAddress) {
    return "User address is required";
  }
  
  if (!params.fromToken || params.fromToken !== 'XLM') {
    return "Only XLM token is supported";
  }
  
  if (!params.destToken || params.destToken !== 'HOLSKEY') {
    return "Only HOLSKEY token is supported";
  }
  
  if (!params.amount || params.amount <= 0) {
    return "Amount must be greater than 0";
  }
  
  if (!params.destChain || params.destChain !== '17000') {
    return "Only Holsky Testnet (17000) is supported";
  }
  
  if (!params.recipientAddress) {
    return "Recipient address is required";
  }
  
  // Validate Ethereum-like address format for Holsky Testnet
  if (params.destChain === '17000') {
    if (!params.recipientAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return "Invalid recipient address format for Holsky Testnet";
    }
  }
  
  return null;
};

// Get account data from Stellar Horizon API
export const getAccountData = async (address: string, network: string): Promise<AccountData> => {
  const horizonUrl = network === 'mainnet' 
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org';
  
  console.log(`🔍 Fetching account data for ${address} from ${horizonUrl}`);
  
  try {
    const response = await fetch(`${horizonUrl}/accounts/${address}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Account not found. Please fund your account first.');
      }
      throw new Error(`Failed to fetch account data: ${response.status}`);
    }
    
    const accountData = await response.json();
    console.log('✅ Account data fetched:', { 
      sequence: accountData.sequence,
      balance: accountData.balances?.[0]?.balance 
    });
    
    return {
      sequence: accountData.sequence,
      balances: accountData.balances
    };
  } catch (error) {
    console.error('❌ Failed to fetch account data:', error);
    throw error;
  }
};

// Build actual Stellar transaction using Stellar SDK
export const buildStellarTransaction = async (
  params: BridgeParams, 
  config: BridgeConfig, 
  accountData: AccountData
): Promise<TransactionBuildResult> => {
  console.log('🔒 Building Stellar transaction with SDK...');
  console.log('📊 Parameters:', params);
  console.log('📋 Config:', config);
  console.log('💰 Account data:', accountData);
  
  try {
    // Create Account object from account data
    const account = new Account(params.userAddress, accountData.sequence.toString());
    console.log('👤 Account created:', { accountId: account.accountId(), sequence: account.sequenceNumber() });
    
    // Create Contract object for the bridge contract
    const contract = new Contract(config.contractId);
    console.log('📋 Contract created:', config.contractId);
    
    // Get network passphrase
    const networkPassphrase = config.network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
    console.log('🌐 Network passphrase:', networkPassphrase);
    
    // Convert amount to stroops (1 XLM = 10,000,000 stroops)
    const amountStroops = Math.floor(params.amount * 10_000_000);
    console.log('💰 Amount in stroops:', amountStroops);
    
    // Build the transaction using TransactionBuilder
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: networkPassphrase,
    })
    .addOperation(
      contract.call(
        'lock',
        nativeToScVal(params.userAddress, { type: 'address' }),           // User address
        nativeToScVal('native', { type: 'string' }),                     // From token (XLM native)
        nativeToScVal(params.destToken, { type: 'string' }),             // Destination token
        nativeToScVal(amountStroops, { type: 'i128' }),                  // Amount in stroops
        nativeToScVal(Buffer.from(params.destChain), { type: 'bytes' }), // Destination chain as bytes
        nativeToScVal(params.recipientAddress, { type: 'string' })       // Recipient address
      )
    )
    .setTimeout(30)
    .build();
    
    console.log('✅ Transaction built successfully');
    console.log('📝 Transaction XDR:', transaction.toXDR());
    
    return {
      transaction,
      transactionXDR: transaction.toXDR(),
      contractCall: {
        contractId: config.contractId,
        method: 'lock',
        parameters: {
          user: params.userAddress,
          fromToken: 'native', // XLM native
          destToken: params.destToken,
          amount: amountStroops,
          destChain: params.destChain,
          recipientAddress: params.recipientAddress
        }
      },
      networkConfig: {
        network: config.network,
        networkPassphrase: networkPassphrase,
        rpcUrl: config.rpcUrl
      }
    };
  } catch (error) {
    console.error('❌ Failed to build Stellar transaction:', error);
    throw new Error(`Failed to build transaction: ${(error as Error).message}`);
  }
};

// Build lock transaction for Soroban contract (legacy function)
export const buildLockTransaction = async (params: BridgeParams, config: BridgeConfig) => {
  console.log('🔒 Building lock transaction with params:', params);
  console.log('📋 Bridge config:', config);
  
  // Legacy implementation for backwards compatibility
  const contractCall = {
    contractId: config.contractId,
    method: 'lock',
    parameters: {
      user: params.userAddress,
      fromToken: params.fromToken, // XLM (native Stellar)
      destToken: params.destToken,
      amount: params.amount,
      destChain: params.destChain,
      recipientAddress: params.recipientAddress
    }
  };
  
  return {
    contractCall,
    params: {
      network: config.network,
      rpcUrl: config.rpcUrl,
      networkPassphrase: config.networkPassphrase
    }
  };
};

// Execute bridge transaction (with frontend-built transactions)
export const executeBridgeTransaction = async (
  params: BridgeParams, 
  network: string, 
  onProgress?: (progress: number) => void,
  actor?: Actor
): Promise<BridgeResult> => {
  // Validate parameters
  const validationError = validateBridgeParams(params);
  if (validationError) {
    throw new Error(validationError);
  }
  
  const config = getBridgeConfig(network);
  onProgress?.(10);
  
  console.log('🔒 Starting bridge execution...');
  console.log('📊 Bridge parameters:', params);
  console.log('⚙️ Network config:', config);
  
  // Build the transaction
  onProgress?.(25);
  const { contractCall } = await buildLockTransaction(params, config);
  console.log('📝 Contract call built:', contractCall);
  
  // Build the transaction on frontend using Stellar SDK
  try {
    onProgress?.(30);
    console.log('🔍 Fetching account data from Stellar...');
    
    // Get account data (sequence number, etc.)
    const accountData = await getAccountData(params.userAddress, config.network);
    
    onProgress?.(40);
    console.log('🔨 Building Soroban contract transaction...');
    
    // Build the actual Stellar transaction using Stellar SDK
    const { transactionXDR, contractCall: stellarContractCall, networkConfig } = await buildStellarTransaction(params, config, accountData);
    
    console.log('✅ Transaction built on frontend:', {
      contractId: stellarContractCall.contractId,
      method: stellarContractCall.method,
      xdrLength: transactionXDR.length
    });
    
    // If backend actor is available, use it for signing and submission
    if (actor) {
      try {
        onProgress?.(60);
        console.log('📞 Sending transaction to backend for signing...');
        
        // Call a simpler backend function that just signs and submits the XDR
        const signResult = await actor.sign_transaction_stellar(
          params.userAddress,
          transactionXDR,
          network
        );
        
        onProgress?.(80);
        
        if ('Ok' in signResult) {
          console.log('✅ Transaction signed successfully');
          
          onProgress?.(90);
          console.log('📤 Submitting signed transaction to Stellar network...');
          
          // Submit the signed transaction
          const submitResult = await actor.submit_transaction(signResult.Ok, network);
          
          if ('Ok' in submitResult) {
            const submissionResponse = JSON.parse(submitResult.Ok);
            console.log('✅ Transaction submitted successfully:', submissionResponse);
            
            onProgress?.(100);
            
            const result: BridgeResult = {
              success: true,
              hash: submissionResponse.hash || `stellar_tx_${Date.now()}`,
              message: "Soroban lock contract executed successfully",
              explorer_url: `https://stellar.expert/explorer/${config.network}/tx/${submissionResponse.hash || 'demo'}`,
              contractDetails: {
                contractId: stellarContractCall.contractId,
                sequenceNumber: accountData.sequence,
                network: networkConfig.network,
                userAddress: params.userAddress,
                transactionXDR: transactionXDR
              },
              bridgeDetails: {
                fromChain: 'Stellar',
                toChain: getChainName(params.destChain),
                amount: params.amount.toString(),
                token: params.destToken,
                recipient: params.recipientAddress,
                contractExecution: true
              }
            };
            
            console.log('✅ Frontend-built Soroban bridge completed:', result);
            return result;
          } else {
            throw new Error(`Transaction submission failed: ${submitResult.Err}`);
          }
        } else {
          throw new Error(`Transaction signing failed: ${signResult.Err}`);
        }
      } catch (error) {
        console.error('❌ Backend signing/submission error:', error);
        throw new Error(`Transaction signing/submission failed: ${(error as Error).message || error}`);
      }
    } else {
      // No backend actor available - return transaction for manual handling
      console.warn('⚠️ No backend actor available for signing');
      throw new Error('Backend not available for transaction signing');
    }
  } catch (error) {
    console.error('❌ Frontend transaction building error:', error);
    throw new Error(`Transaction building failed: ${(error as Error).message || error}`);
  }
};

// Estimate bridge fees (demo implementation)
export const estimateBridgeFees = async (params: BridgeParams, network: string) => {
  const config = getBridgeConfig(network);
  
  // Mock fee calculation based on amount and destination chain
  const baseNetworkFee = 0.00001; // Base Stellar network fee
  const bridgeFeePercent = 0.001; // 0.1% bridge fee
  
  const networkFee = baseNetworkFee;
  const bridgeFee = params.amount * bridgeFeePercent;
  const totalFee = networkFee + bridgeFee;
  
  return {
    networkFee: networkFee.toFixed(7),
    bridgeFee: bridgeFee.toFixed(7),
    totalFee: totalFee.toFixed(7)
  };
};

// Get supported destination chains
export const getSupportedChains = () => [
  { id: '17000', name: 'Holsky Testnet', symbol: 'ETH', icon: '🔷' }
];

// Get supported destination tokens
export const getSupportedTokens = () => [
  { symbol: 'HOLSKEY', name: 'Holskey Token', chains: ['17000'] }
];

// Get supported source tokens (from Stellar)
export const getSupportedSourceTokens = () => [
  { symbol: 'XLM', name: 'Stellar Lumens', type: 'native' }
];

export default {
  getBridgeConfig,
  getChainName,
  validateBridgeParams,
  getAccountData,
  buildStellarTransaction,
  buildLockTransaction,
  executeBridgeTransaction,
  estimateBridgeFees,
  getSupportedChains,
  getSupportedTokens,
  getSupportedSourceTokens
};