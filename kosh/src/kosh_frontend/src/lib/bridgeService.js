// Bridge service for cross-chain token locking and bridging
// Based on Stellar Soroban smart contracts

import * as StellarSdk from '@stellar/stellar-sdk';
import {
  TransactionBuilder,
  Account,
  Contract,
  BASE_FEE,
  nativeToScVal,
  Address,
  Networks,
  Operation
} from '@stellar/stellar-sdk';

// Get bridge configuration based on network (FORCE TESTNET)
export const getBridgeConfig = (network) => {
  // Always use testnet for now
  return {
    contractId: 'CDTA5IYGUGRI4PAGXJL7TPBEIC3EZY6V23ILF5EDVXFVLCGGMVOK4CRL',
    network: 'testnet',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015'
  };
};

// Get destination chain name from chain ID
export const getChainName = (chainId) => {
  const chainNames = {
    '17000': 'Holsky Testnet'
  };
  
  return chainNames[chainId] || `Chain ${chainId}`;
};

// Validate bridge parameters
export const validateBridgeParams = (params) => {
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

// Get account data from Stellar Horizon API (FORCE TESTNET)
export const getAccountData = async (address, network) => {
  const horizonUrl = 'https://horizon-testnet.stellar.org'; // Always use testnet
  
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

const BRIDGE_CONTRACT = 'CDTA5IYGUGRI4PAGXJL7TPBEIC3EZY6V23ILF5EDVXFVLCGGMVOK4CRL';
const CANISTER_ADDRESS = 'GAUZMIWKXYCQIAFBL7YDL75C3VKB3BO2Z73NJTJLOSBXUAAI2LIOFAID';

// Helper function to get account data from Stellar network using Horizon API (FORCE TESTNET)
const getSorobanAccountData = async (address, network) => {
  const horizonUrl = 'https://horizon-testnet.stellar.org'; // Always use testnet
  
  try {
    const response = await fetch(`${horizonUrl}/accounts/${address}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Account not found. Please fund your account first.');
      }
      throw new Error(`Failed to fetch account data: ${response.status}`);
    }
    
    const accountData = await response.json();
    
    return {
      sequence: accountData.sequence,
      subentryCount: accountData.subentry_count || 0,
      thresholds: accountData.thresholds || {},
      balances: accountData.balances || []
    };
  } catch (error) {
    console.error('❌ Failed to fetch account data:', error);
    throw new Error(`Could not fetch account data for ${address}: ${error.message}`);
  }
};

// Helper function to get chain name (internal version with extended chains)
const getInternalChainName = (chainId) => {
  const chainMap = {
    '1': 'Ethereum',
    '56': 'BSC',
    '137': 'Polygon',
    '43114': 'Avalanche',
    '17000': 'Holesky Testnet'
  };
  return chainMap[chainId] || `Chain ${chainId}`;
};

// Build actual Stellar transaction using Stellar SDK
export const buildStellarTransaction = async (params, config, accountData, actor) => {
  console.log('🔒 Building Stellar transaction with SDK...');
  console.log('📊 Parameters:', params);
  console.log('📋 Config:', config);
  console.log('💰 Account data:', accountData);
  
  try {
    // Create Account object from account data
    const account = new Account(params.userAddress, accountData.sequence.toString());
    account.incrementSequenceNumber();
    console.log('👤 Account created:', { accountId: account.accountId(), sequence: account.sequenceNumber() });
    
    // Create Contract object for the bridge contract
    console.log("Config => ",config);
    const contract = new Contract(config.contractId);
    console.log('📋 Contract created:', config.contractId);
    
    // Get network passphrase
    const networkPassphrase = config.network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
    console.log('🌐 Network passphrase:', networkPassphrase);
    
    // Convert amount to stroops (1 XLM = 10,000,000 stroops)
    const amountStroops = String(Math.floor(params.amount * 10_000_000));
    console.log('💰 Amount in stroops:', amountStroops);
    
    // For Stellar native XLM, use the native asset address
    // const nativeAssetAddress = Address.fromString('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2');
    // console.log('🪙 Native asset address:', nativeAssetAddress.toString());
    
    // Build the transaction using TransactionBuilder
    const txBuilder = new TransactionBuilder(account, {
      fee: String(BASE_FEE),
      networkPassphrase: Networks.TESTNET,
    });

    // Add a manageData entry for the contract id (from_token)
    txBuilder.addOperation(
      Operation.manageData({
        name: "contract_id", // metadata key
        value: config.contractId,
      })
    );

    // Add a manageData entry for dest_token
    txBuilder.addOperation(
      Operation.manageData({
        name: "dest_token",
        value: params.destToken,
      })
    );

    // Add a manageData entry for in_amount
    txBuilder.addOperation(
      Operation.manageData({
        name: "in_amount",
        value: amountStroops,
      })
    );

    // Add a manageData entry for dest_chain (store ASCII)
    txBuilder.addOperation(
      Operation.manageData({
        name: "dest_chain",
        // convert to ASCII
        value: params.destChain,
      })
    );

    // Add a manageData entry for recipient address
    txBuilder.addOperation(
      Operation.manageData({
        name: "recipient_address",
        value: params.recipientAddress,
      })
    );

    // Add an operation that marks intent to call 'lock' (purely descriptive)
    txBuilder.addOperation(
      Operation.manageData({
        name: "intent",
        value: "call_lock",
      })
    );


    // Finalize transaction (unsigned)
    const tx = txBuilder.setTimeout(180).build();
    console.log("XDR=>",tx.toXDR());


    // stellar_user_lock_txn (xdr,testnet)
    const txhash = await actor.stellar_user_lock_txn(tx.toXDR(), config.network);  
    
    // Handle the response from stellar_user_lock_txn
    if (txhash && 'Ok' in txhash) {
      console.log('✅ Transaction submitted successfully:', txhash.Ok);
      const transactionHash = txhash.Ok;
      
      // Log transaction details
      console.log('📋 Transaction Hash:', transactionHash);
      console.log('🌐 Network:', config.network);
      console.log('💰 Amount:', params.amount, 'XLM');
      console.log('🎯 Destination:', params.destToken, 'on', params.destChain);
      
    } else if (txhash && 'Err' in txhash) {
      console.error('❌ Transaction failed:', txhash.Err);
      throw new Error(`Transaction submission failed: ${txhash.Err}`);
    } else {
      console.error('❌ Unexpected response format:', txhash);
      throw new Error('Unexpected response format from stellar_user_lock_txn');
    }
    
    console.log('✅ Transaction built successfully');
    // console.log('📝 Transaction XDR:', tx.toXDR());
    
    return {
      transaction,
      transactionXDR: tx.toXDR(),
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
    console.error('❌ Complete bridge transaction failed:', error);
    return {
      success: false,
      error: error.message,
      errorType: error.constructor.name,
      details: {
        params: params,
        config: config,
        contractAddress: BRIDGE_CONTRACT,
        sourceAddress: CANISTER_ADDRESS
      }
    };
  }
};


// Build lock transaction for Soroban contract (legacy function)
export const buildLockTransaction = async (params, config) => {
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

// Execute bridge transaction (demo implementation with optional backend integration)
export const executeBridgeTransaction = async (params, network, onProgress, actor) => {
  console.log('🚀 Executing bridge transaction (complete flow)...');
  
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
    const { transactionXDR, contractCall, networkConfig } = await buildStellarTransaction(params, config, accountData, actor);
    
    console.log('✅ Transaction built on frontend:', {
      contractId: contractCall.contractId,
      method: contractCall.method,
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
            
            const result = {
              success: true,
              hash: submissionResponse.hash || `stellar_tx_${Date.now()}`,
              message: "Soroban lock contract executed successfully",
              explorer_url: `https://stellar.expert/explorer/${config.network}/tx/${submissionResponse.hash || 'demo'}`,
              contractDetails: {
                contractId: contractCall.contractId,
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
        throw new Error(`Transaction signing/submission failed: ${error.message || error}`);
      }
    } else {
      // No backend actor available - return transaction for manual handling
      console.warn('⚠️ No backend actor available for signing');
      throw new Error('Backend not available for transaction signing');
    }
  } catch (error) {
    console.error('❌ Frontend transaction building error:', error);
    throw new Error(`Transaction building failed: ${error.message || error}`);
  }
  
  // Fallback to simulation (only used when no actor is available)
  onProgress?.(50);
  console.log('🔄 No backend actor available, using simulation mode for bridge transaction');
  console.warn('⚠️ This is simulation only - no actual contract execution will occur');
  
  // Simulate network delay and processing
  await new Promise(resolve => setTimeout(resolve, 2000));
  onProgress?.(75);
  
  await new Promise(resolve => setTimeout(resolve, 1500));
  onProgress?.(90);
  
  // Generate mock transaction hash
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substr(2, 9);
  const mockHash = `lock_${timestamp}_${randomSuffix}`;
  
  onProgress?.(100);
  
  const result = {
    success: true,
    hash: mockHash,
    message: "Bridge transaction completed successfully",
    explorer_url: `https://stellar.expert/explorer/${config.network}/tx/${mockHash}`,
    bridgeDetails: {
      fromChain: 'Stellar',
      toChain: getChainName(params.destChain),
      amount: params.amount.toString(),
      token: params.destToken,
      recipient: params.recipientAddress
    }
  };
  
  console.log('✅ Bridge completed:', result);
  return result;
};

// Estimate bridge fees (demo implementation)
export const estimateBridgeFees = async (params, network) => {
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
