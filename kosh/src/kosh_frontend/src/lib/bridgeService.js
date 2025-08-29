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
  Operation,
  TimeoutInfinite,
  xdr
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
export const buildStellarTransaction = async (params, config, actor, onProgress) => {
  console.log('🌉 Starting complete Stellar Bridge Transaction');
  console.log('📋 Contract:', BRIDGE_CONTRACT);
  console.log('🔑 Canister:', CANISTER_ADDRESS);
  console.log('📊 Parameters:', params);
  console.log('⚙️ Config:', config);

  try {
    // Step 1: Validate parameters
    onProgress?.(10);
    const {
      userAddress,        // User's Stellar address
      recipientAddress,   // Ethereum recipient address
      amount = 1.0,       // XLM amount (default 1.0)
      destToken = 'HOLSKEY',
      destChain = '17000'
    } = params;

    // Validate required parameters
    if (!userAddress || typeof userAddress !== 'string') {
      throw new Error('userAddress is required (Stellar address of the user)');
    }
    if (!recipientAddress || typeof recipientAddress !== 'string') {
      throw new Error('recipientAddress is required (Ethereum address)');
    }

    console.log('✅ Parameters validated');
    console.log('👤 User Address:', userAddress);
    console.log('🎯 Recipient:', recipientAddress);
    console.log('💰 Amount:', amount, 'XLM');

    // Step 2: Get account data from Stellar network (USE USER ADDRESS!)
    onProgress?.(25);
    console.log('🔍 Fetching USER account data from Stellar...');
    
    const accountData = await getSorobanAccountData(userAddress, 'testnet');
    console.log('📊 Account data retrieved:', {
      address: userAddress,
      sequence: accountData.sequence
    });

    // Step 3: Build the transaction
    onProgress?.(40);
    console.log('🔨 Building Soroban contract transaction...');

    // Create account object for the USER (source account)
    const userAccount = new Account(userAddress, accountData.sequence.toString());
    console.log('🏦 User Account created with sequence:', userAccount.sequenceNumber());

    // Network setup (FORCE TESTNET)
    const networkType = 'testnet'; // Always use testnet
    const networkPassphrase = Networks.TESTNET;
    console.log('🌐 Using network:', networkType);

    // Convert amount to stroops
    const amountStroops = Math.floor(amount * 10_000_000);
    console.log('💰 Amount in stroops:', amountStroops);

    // Prepare contract arguments
    const contractArgs = [
      nativeToScVal(Address.fromString(userAddress), { type: 'address' }),
      nativeToScVal('native', { type: 'string' }),
      nativeToScVal(destToken, { type: 'string' }),
      nativeToScVal(amountStroops, { type: 'i128' }),
      nativeToScVal(destChain, { type: 'string' }),
      nativeToScVal(recipientAddress, { type: 'string' })
    ];

    console.log('📋 Contract arguments prepared:', contractArgs.length, 'args');

    // Build the contract for Soroban invocation
    const contract = new Contract(BRIDGE_CONTRACT);
    
    // Build the transaction using contract.call method
    const transaction = new TransactionBuilder(userAccount, {
      fee: (100 * 100000).toString(), // 0.01 XLM fee for Soroban
      networkPassphrase: networkPassphrase,
    })
    .addOperation(
      contract.call('lock', ...contractArgs)
    )
    .setTimeout(TimeoutInfinite) // Infinite timeout for Soroban
    .build();

    console.log('✅ Transaction built successfully');

    // Generate XDR
    const transactionXDR = transaction.toXDR('base64');
    console.log('📝 XDR generated, length:', transactionXDR.length);

    // Validate XDR
    try {
      const validationTx = TransactionBuilder.fromXDR(transactionXDR, networkPassphrase);
      console.log('✅ XDR validation successful');
    } catch (validationError) {
      console.error('❌ XDR validation failed:', validationError);
      throw new Error(`Generated XDR is invalid: ${validationError.message}`);
    }

    // Step 4: For now, just console.log the XDR instead of backend calls
    console.log('🎯 SOROBAN CONTRACT TRANSACTION XDR:');
    console.log('📝 XDR Base64:', transactionXDR);
    console.log('🏷️ Contract:', BRIDGE_CONTRACT);
    console.log('⚙️ Function: lock');
    console.log('📊 Args Count:', contractArgs.length);
    console.log('🌐 Network:', networkType);
    console.log('👤 Source Address (USER):', userAddress);
    console.log('🎯 Recipient:', params.recipientAddress);
    console.log('💰 Amount:', params.amount, 'XLM');
    console.log('🔑 IMPORTANT: Transaction will be signed by USER address, not canister!');
    
    onProgress?.(100);
    
    return {
      success: true,
      message: "Soroban contract XDR generated successfully",
      transactionXDR: transactionXDR,
      contractDetails: {
        contractId: BRIDGE_CONTRACT,
        sourceAddress: userAddress, // USER is the source now!
        userAddress: userAddress,
        function: 'lock',
        args: contractArgs,
        network: networkType
      }
    };
    
    if (false && actor) { // Disabled backend calls for now
      try {
        onProgress?.(60);
        console.log('📞 Sending transaction to backend for signing...');
        
        // Call backend to sign the transaction
        const signResult = await actor.sign_transaction_stellar(
          userAddress,
          transactionXDR,
          networkType
        );
        
        onProgress?.(80);
        
        if ('Ok' in signResult) {
          console.log('✅ Transaction signed successfully');
          
          onProgress?.(90);
          console.log('📤 Submitting signed transaction to Stellar network...');
          
          // Submit the signed transaction
          const submitResult = await actor.submit_transaction(signResult.Ok, networkType);
          
          if ('Ok' in submitResult) {
            const submissionResponse = JSON.parse(submitResult.Ok);
            console.log('✅ Transaction submitted successfully:', submissionResponse);
            
            onProgress?.(100);
            
            // Return complete success result
            return {
              success: true,
              hash: submissionResponse.hash || `stellar_tx_${Date.now()}`,
              message: "Stellar bridge transaction completed successfully",
              explorer_url: `https://stellar.expert/explorer/${networkType}/tx/${submissionResponse.hash || 'demo'}`,
              transactionXDR: transactionXDR,
              signedTransactionXDR: signResult.Ok,
              contractDetails: {
                contractId: BRIDGE_CONTRACT,
                sourceAddress: CANISTER_ADDRESS,
                userAddress: userAddress,
                sequenceNumber: accountData.sequence,
                network: networkType,
                fee: '10000000' // 0.01 XLM in stroops
              },
              bridgeDetails: {
                fromChain: 'Stellar',
                toChain: getInternalChainName(destChain),
                amount: amount.toString(),
                amountStroops: amountStroops,
                token: destToken,
                recipient: recipientAddress,
                contractExecution: true
              },
              networkConfig: {
                network: networkType,
                networkPassphrase: networkPassphrase,
                rpcUrl: 'https://soroban-testnet.stellar.org:443' // Always testnet
              }
            };
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
      // No backend actor - return transaction data for external handling
      console.warn('⚠️ No backend actor available - returning transaction data');
      
      return {
        success: false,
        needsExternalSigning: true,
        message: "Transaction built but requires external signing",
        transactionXDR: transactionXDR,
        contractDetails: {
          contractId: BRIDGE_CONTRACT,
          sourceAddress: CANISTER_ADDRESS,
          userAddress: userAddress,
          sequenceNumber: accountData.sequence,
          network: networkType
        },
        bridgeDetails: {
          fromChain: 'Stellar',
          toChain: getInternalChainName(destChain),
          amount: amount.toString(),
          token: destToken,
          recipient: recipientAddress
        },
        instructions: "Use this XDR with your signing backend to complete the transaction"
      };
    }

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
  if (!params.userAddress) {
    throw new Error('userAddress is required');
  }
  if (!params.recipientAddress) {
    throw new Error('recipientAddress is required');
  }
  if (!params.amount || params.amount <= 0) {
    throw new Error('amount must be greater than 0');
  }

  const config = {
    network: 'testnet', // Always testnet
    contractId: BRIDGE_CONTRACT,
    canisterAddress: CANISTER_ADDRESS,
    rpcUrl: 'https://soroban-testnet.stellar.org:443' // Always testnet
  };

  // Call the main function that does everything
  const result = await buildStellarTransaction(params, config, actor, onProgress);
  
  if (result.success) {
    console.log('✅ Bridge transaction executed successfully:', result.hash);
    return result;
  } else {
    console.error('❌ Bridge transaction failed:', result.error);
    throw new Error(result.error || 'Bridge transaction failed');
  }
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
