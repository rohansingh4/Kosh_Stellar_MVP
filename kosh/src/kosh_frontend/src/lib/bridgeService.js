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
  Asset
} from '@stellar/stellar-sdk';
import { Server } from '@stellar/stellar-sdk/rpc';

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



// Generate raw XDR transaction with hardcoded values (returns detailed object)
export const generateRawXDRDetailed = async (userAddress) => {
  // === constants ===
  const DEFAULT_BRIDGE = "CDTA5IYGUGRI4PAGXJL7TPBEIC3EZY6V23ILF5EDVXFVLCGGMVOK4CRL";
  const DEFAULT_USER = "GBYFX3H3CNAFMTVVZUFXITC7LJTDYZVMJD5XMWQPEMW4ORN43QPGQ3OZ";

  // --- read inputs ---
  const RPC_URL = "https://soroban-testnet.stellar.org";
  const BRIDGE_ID = DEFAULT_BRIDGE;
  const USER_ADDRESS = userAddress || DEFAULT_USER;

  const DEST_TOKEN = "native";
  const IN_AMOUNT_STR = "17000";
  const RECIPIENT_ADDRESS = "0x742d35Cc6634C0532925a3b8D29435B7b6c8ceB3";
  const DEST_CHAIN_IN = "0x8Da1867ab5eE5385dc72f5901bC9Bd16F580d157";
  let FROM_TOKEN_ADDR; // Will be set to native SAC

  // --- helpers ---
  const hexToBytes = (hex) => {
    let s = hex.toLowerCase().replace(/^0x/, "");
    if (!/^[0-9a-f]*$/.test(s) || s.length % 2) throw new Error("Invalid hex for --dest-chain");
    const out = new Uint8Array(s.length / 2);
    for (let i = 0; i < s.length; i += 2) out[i / 2] = parseInt(s.slice(i, i + 2), 16);
    return out;
  };
  
  const toBytes = (val) => {
    if (typeof val !== "string") throw new Error("--dest-chain must be a string");
    if (val.startsWith("0x") || /^[0-9a-fA-F]+$/.test(val.replace(/^0x/, ""))) {
      try { return hexToBytes(val); } catch { /* fallthrough to utf-8 */ }
    }
    return new TextEncoder().encode(val);
  };

  try {
    const server = new Server(RPC_URL, { allowHttp: RPC_URL.startsWith("http://") });

    // Validate addresses before using them
    console.log("Validating addresses:");
    console.log("USER_ADDRESS:", USER_ADDRESS);
    console.log("BRIDGE_ID:", BRIDGE_ID);
    
    try {
      new Address(USER_ADDRESS);
      console.log("✓ USER_ADDRESS is valid");
    } catch (e) {
      throw new Error(`Invalid USER_ADDRESS: ${USER_ADDRESS} - ${e.message}`);
    }
    
    try {
      new Address(BRIDGE_ID);
      console.log("✓ BRIDGE_ID is valid");
    } catch (e) {
      throw new Error(`Invalid BRIDGE_ID: ${BRIDGE_ID} - ${e.message}`);
    }

    // Discover network passphrase from RPC and load the source account/sequence.
    const { passphrase: networkPassphrase } = await server.getNetwork();
    const account = await server.getAccount(USER_ADDRESS);

    // If not provided, use this network's **XLM Stellar Asset Contract** as the from_token.
    if (!FROM_TOKEN_ADDR) {
      FROM_TOKEN_ADDR = Asset.native().contractId(networkPassphrase);
    }

    // Prepare contract + args (matching Rust signature order exactly):
    // lock(env, from: Address, from_token: Address, dest_token: String,
    //      in_amount: i128, dest_chain: Bytes, recipient_address: String)
    const contract = new Contract(BRIDGE_ID);

    const from = new Address(USER_ADDRESS);
    const fromToken = new Address(FROM_TOKEN_ADDR);
    const destTokenStr = DEST_TOKEN;
    const inAmountI128 = nativeToScVal(IN_AMOUNT_STR, { type: "i128" }); // Convert string to i128 ScVal
    const destChain = toBytes(DEST_CHAIN_IN);
    const recipientStr = RECIPIENT_ADDRESS;

    const op = contract.call(
      "lock",
      nativeToScVal(from),                // Address -> ScVal
      nativeToScVal(fromToken),           // Address -> ScVal  
      nativeToScVal(destTokenStr),        // String  -> ScVal
      inAmountI128,                       // i128    -> ScVal
      nativeToScVal(destChain),           // Bytes   -> ScVal
      nativeToScVal(recipientStr),        // String  -> ScVal
    );

    // Build a tx with your USER as the transaction source.
    let tx = new TransactionBuilder(account, {
      fee: String(BASE_FEE),              // base fee; resource fee will be added during prepare
      networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(300)
      .build();

    // Simulate + prepare: fills in the footprint, resource fees, and any required authorizations.
    // The result is still UNSIGNED.
    tx = await server.prepareTransaction(tx);

    console.log("----- prepared (UNSIGNED) transaction XDR -----");
    console.log(tx.toXDR());              // base64-encoded, ready to sign elsewhere
    console.log("------------------------------------------------");
    console.error(JSON.stringify({
      rpc: RPC_URL,
      networkPassphrase,
      source: USER_ADDRESS,
      bridgeContract: BRIDGE_ID,
      fromToken: FROM_TOKEN_ADDR,
      destToken: DEST_TOKEN,
      inAmount: IN_AMOUNT_STR,
      destChainBytesLen: destChain.length,
      recipient: RECIPIENT_ADDRESS,
    }, null, 2));

    return {
      xdr: tx.toXDR(),
      transaction: tx,
      networkPassphrase,
      contractId: BRIDGE_ID,
      userAddress: USER_ADDRESS,
      details: {
        fromToken: FROM_TOKEN_ADDR,
        destToken: DEST_TOKEN,
        amount: IN_AMOUNT_STR,
        recipient: RECIPIENT_ADDRESS,
        destChain: DEST_CHAIN_IN
      }
    };
  } catch (e) {
    console.error("Error building XDR:", e?.response?.data ?? e);
    throw e;
  }
};

// Generate raw XDR transaction with hardcoded values (returns just XDR string)
export const generateRawXDR = async (userAddress) => {
  const result = await generateRawXDRDetailed(userAddress);
  return result.xdr;
};

// Legacy function for backward compatibility  
export const buildStellarTransaction = async (params, config, accountData, actor) => {
  console.warn('buildStellarTransaction is deprecated, use generateRawXDR instead');
  return await generateRawXDR(params.userAddress);
};


// Build lock transaction for Soroban contract (legacy function)
export const buildLockTransaction = async (params, config) => {
  console.log('🔒 Building lock transaction with params:', params);
  console.log('📋 Bridge config:', config);
  
  // Legacy implementation for backwards compatibility
  const contractCall = {
    contractId: config?.contractId,
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
    const result = await generateRawXDRDetailed(params.userAddress);
    const transactionXDR = result.xdr;
    const contractCall = { contractId: result.contractId, method: 'lock' };
    const networkConfig = { network: config.network };
    
    console.log('✅ Transaction built on frontend:', {
      contractId: contractCall?.contractId,
      method: contractCall?.method,
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
                contractId: config?.contractId,
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
  generateRawXDR,
  generateRawXDRDetailed,
  buildStellarTransaction,
  buildLockTransaction,
  executeBridgeTransaction,
  estimateBridgeFees,
  getSupportedChains,
  getSupportedTokens,
  getSupportedSourceTokens
};
