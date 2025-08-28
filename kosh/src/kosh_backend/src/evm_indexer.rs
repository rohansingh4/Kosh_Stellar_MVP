use candid::Principal; // Import for Principal
use candid::{CandidType, Nat};

use ethabi::ethereum_types::H256;
use ethabi::{decode, ParamType, Token};
use hex::decode as hex_decode;
use ic_cdk::api::call::call_with_payment128;
use ic_cdk::api::time;
use ic_cdk::pre_upgrade;
use ic_cdk::{post_upgrade, update};
use ic_cdk_timers::{set_timer, set_timer_interval, TimerId};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};


use crate::evm_rpc_bindings::{
    BlockTag,
    GetBlockByNumberResult,
    GetLogsArgs,
    GetLogsResult,
    MultiGetBlockByNumberResult,
    MultiGetLogsResult,
    RpcApi,
    RpcConfig,
    RpcServices,
    Service as EvmRpcService, // This is your interface to the canister
};



#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct TransactionDetails {
    pub from: String,
    pub to: String,
    pub amount: u64,
    pub src_chain_id: u64,
    pub dest_chain_id: u64,
    pub block_number: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug, Serialize)]
pub struct TransactionReleaseDetails {
    pub status: bool,
    pub releasetxn: Option<String>,
}

thread_local! {
    static TRANSACTION_MAP: RefCell<HashMap<String, TransactionDetails>> = RefCell::new(HashMap::new());
}

thread_local! {
    static TRANSACTION_MAP_RELEASE: RefCell<HashMap<String, TransactionReleaseDetails>> = RefCell::new(HashMap::new());
}

thread_local! {
    static BLOCK_NUMBER: RefCell<u64> = RefCell::new(8845457);
}

thread_local! {
    pub static CHAIN_SERVICE: RefCell<Option<ChainService>> = RefCell::new(None);
}

#[derive(Clone, Debug)]
pub struct ChainService {
    canister_id: String,
    pub evm_rpc: EvmRpcService,
    last_checked_time: RefCell<u64>,
    timer_id: RefCell<Option<TimerId>>,
    // 86871172
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct LogDetails {
    pub from: String,
    pub to: String,
    pub amount: u64,
    pub src_chain_id: u64,
    pub txn_hash: String,
    pub dest_chain_id: u64,
}

impl ChainService {
    pub fn new(canister_id: String) -> Self {
        let principal = Principal::from_text("7hfb6-caaaa-aaaar-qadga-cai").unwrap();
        let evm_rpc = EvmRpcService(principal);
        let last_checked_time = RefCell::new(time() / 1_000_000);
        let timer_id = RefCell::new(None);

        ChainService {
            canister_id,
            evm_rpc,
            last_checked_time,
            timer_id,
        }
    }


    pub async fn fetch_token_locked_logs(
        &self,
        from_block: u64,
        to_block: u64,
        address_filter: Option<String>,
    ) -> Result<Vec<String>, String> {
        ic_cdk::println!(
            "🚀 Starting fetch_token_locked_logs from block {} to {}",
            from_block,
            to_block
        );

        // Keccak256 hash of the TokenLocked event signature:
        // "TokenLocked(address,address,uint256,uint256,string)"
        let token_locked_event_signature =
            "0x87b81f46f02c6b7d0bbf8436a6d65c9a5b9b9f38f7d6c72a4a7b4d45a2f3b1c4".to_string();

        // Convert Option<String> to Vec<String> for filtering addresses
        let addresses: Vec<String> = address_filter.into_iter().collect();

        // Prepare logs filter - topics vector:
        // topic0 = event signature
        // topic1 = indexed from_address (wildcard = None to get all)
        // topic2 = indexed to_address (wildcard)
        let get_logs_args = GetLogsArgs {
            fromBlock: Some(BlockTag::Number(Nat::from(from_block))),
            toBlock: Some(BlockTag::Number(Nat::from(to_block))),
            addresses: addresses.clone(),
            topics: Some(vec![
                Some(token_locked_event_signature),
                None, // wildcard for from_address indexed topic
                None, // wildcard for to_address indexed topic
            ]),
        };

        let rpc_providers = RpcServices::Custom {
            chainId: 17000, // Holesky testnet chain id
            services: vec![RpcApi {
                url: "https://ethereum-holesky-rpc.publicnode.com".to_string(),
                headers: None,
            }],
        };

        let cycles = 100_000_000_000u128;

        // Call eth_getLogs RPC with payment cycles
        let (result,) = ic_cdk::api::call::call_with_payment128::<
            (RpcServices, Option<RpcConfig>, GetLogsArgs),
            (MultiGetLogsResult,),
        >(
            self.evm_rpc.0,
            "eth_getLogs",
            (rpc_providers, None, get_logs_args),
            cycles,
        )
        .await
        .map_err(|e| format!("🧨 Call failed: {:?}", e))?;

        let logs = match result {
            MultiGetLogsResult::Consistent(GetLogsResult::Ok(logs)) => logs,
            MultiGetLogsResult::Consistent(GetLogsResult::Err(e)) => {
                return Err(format!("❌ RPC error (token locked logs): {:?}", e));
            }
            MultiGetLogsResult::Inconsistent(inc) => {
                return Err(format!("⚠ Inconsistent token locked logs result: {:?}", inc));
            }
        };

        let mut token_locked_log_summaries = Vec::new();
        let mut failed_tx_hashes = HashSet::new();

        for log_entry in &logs {
            let tx_hash = log_entry
                .transactionHash
                .clone()
                .unwrap_or_else(|| "N/A".to_string());
            let block_num = log_entry
                .blockNumber
                .clone()
                .map(|n| n.to_string())
                .unwrap_or_else(|| "N/A".to_string());

            // Decode the TokenLocked event from topics and data
            if let Some((
                from_address,
                to_address,
                amount,
                src_chain_id,
                dest_chain,
            )) = Self::decode_token_locked_event_from_log(&log_entry.topics, &log_entry.data)
            {
                ic_cdk::println!("🔒 TokenLocked Event Decoded:");
                ic_cdk::println!("  Tx Hash: {}", tx_hash);
                ic_cdk::println!("  From Address: {}", from_address);
                ic_cdk::println!("  To Address: {}", to_address);
                ic_cdk::println!("  Amount: {}", amount);
                ic_cdk::println!("  Source Chain ID: {}", src_chain_id);
                ic_cdk::println!("  Destination Chain: {}", dest_chain);

                // Process the TokenLocked event for bridging logic
                ic_cdk::println!("🔒 Processing TokenLocked event for bridging...");

                // Store transaction details in TRANSACTION_MAP
                let transaction_details = TransactionDetails {
                    from: from_address.clone(),
                    to: to_address.clone(),
                    amount,
                    src_chain_id,
                    dest_chain_id: 0, // Will be determined by dest_chain string
                    block_number: log_entry.blockNumber.as_ref().map(|n| Self::nat_to_u64(n.clone())).unwrap_or(0),
                };

                TRANSACTION_MAP.with(|map| {
                    map.borrow_mut().insert(tx_hash.clone(), transaction_details);
                });

                token_locked_log_summaries.push(format!(
                    "Tx: {}, Block: {}, From: {}, To: {}, Amount: {}, SrcChainId: {}, DestChain: {}",
                    tx_hash, block_num, from_address, to_address, amount, src_chain_id, dest_chain
                ));
            } else {
                if !failed_tx_hashes.contains(&tx_hash) {
                    ic_cdk::println!("❌ Failed to decode TokenLocked event for Tx: {}", tx_hash);
                    failed_tx_hashes.insert(tx_hash.clone());
                }
                token_locked_log_summaries.push(format!(
                    "Tx: {}, Block: {}, Failed to decode TokenLocked event",
                    tx_hash, block_num
                ));
            }
        }

        ic_cdk::println!(
            "✅ fetch_token_locked_logs completed with {} entries",
            token_locked_log_summaries.len()
        );

        Ok(token_locked_log_summaries)
    }

    /// Decode the TokenLocked event log given raw topics and data from an Ethereum log
    fn decode_token_locked_event_from_log(
        topics: &Vec<String>,
        data: &str,
    ) -> Option<(
        String, // from_address
        String, // to_address
        u64,    // amount
        u64,    // srcChainId
        String, // destChain
    )> {
        // The topics vector should have at least 3 elements: [event signature, from_address, to_address]
        if topics.len() < 3 {
            return None;
        }

        // Decode from_address from topic[1] (address - last 20 bytes of 32-byte topic)
        let from_bytes = hex_decode(topics[1].trim_start_matches("0x")).ok()?;
        if from_bytes.len() != 32 {
            return None;
        }
        let from_addr = &from_bytes[12..32]; // last 20 bytes
        let from_address = format!("0x{}", hex::encode(from_addr));

        // Decode to_address from topic[2] (address - last 20 bytes of 32-byte topic)
        let to_bytes = hex_decode(topics[2].trim_start_matches("0x")).ok()?;
        if to_bytes.len() != 32 {
            return None;
        }
        let to_addr = &to_bytes[12..32]; // last 20 bytes
        let to_address = format!("0x{}", hex::encode(to_addr));

        // Decode non-indexed parameters from "data" field
        let data_bytes = hex_decode(data.trim_start_matches("0x")).ok()?;
        if data_bytes.is_empty() {
            return None;
        }

        // Order and types correspond to Solidity event non-indexed params:
        // uint256 amount, uint256 srcChainId, string destChain
        let param_types = vec![
            ParamType::Uint(256), // amount
            ParamType::Uint(256), // srcChainId
            ParamType::String,    // destChain
        ];

        let tokens = decode(&param_types, &data_bytes).ok()?;

        let amount = match &tokens[0] {
            Token::Uint(n) => n.as_u64(),
            _ => return None,
        };
        let src_chain_id = match &tokens[1] {
            Token::Uint(n) => n.as_u64(),
            _ => return None,
        };
        let dest_chain = match &tokens[2] {
            Token::String(s) => s.clone(),
            _ => return None,
        };

        Some((
            from_address,
            to_address,
            amount,
            src_chain_id,
            dest_chain,
        ))
    }

    pub async fn fetch_logs(
        &self,
        from_block: u64,
        to_block: u64,
        address: Option<String>,
    ) -> Result<Vec<String>, String> {
        ic_cdk::println!("🚀 fetch_logs started...");

        let rpc_providers = RpcServices::Custom {
            chainId: 17000,
            services: vec![RpcApi {
                url: "https://ethereum-holesky-rpc.publicnode.com".to_string(),
                headers: None,
            }],
        };

        let get_logs_args = GetLogsArgs {
            fromBlock: Some(BlockTag::Number(Nat::from(from_block))),
            toBlock: Some(BlockTag::Number(Nat::from(to_block))),
            addresses: address.into_iter().collect(),
            topics: None,
        };

        ic_cdk::println!("📦 get_logs_args: {:?}", get_logs_args);

        let cycles = 100_000_000_000u128;

        let (result,) = ic_cdk::api::call::call_with_payment128::<
            (RpcServices, Option<RpcConfig>, GetLogsArgs),
            (MultiGetLogsResult,),
        >(
            self.evm_rpc.0,
            "eth_getLogs",
            (rpc_providers, None, get_logs_args),
            cycles,
        )
        .await
        .map_err(|e| format!("🧨 Call failed: {:?}", e))?;

        ic_cdk::println!("📨 LOGS_RESULT: {:?}", result);

        let block_logs = match result {
            MultiGetLogsResult::Consistent(GetLogsResult::Ok(logs)) => logs,
            MultiGetLogsResult::Consistent(GetLogsResult::Err(e)) => {
                return Err(format!("❌ RPC error: {:?}", e));
            }
            MultiGetLogsResult::Inconsistent(inconsistent) => {
                return Err(format!("⚠ Inconsistent result: {:?}", inconsistent));
            }
        };

        let mut log_strings = Vec::new();

        for log_entry in &block_logs {
            let transaction_hash = log_entry
                .transactionHash
                .clone()
                .unwrap_or_else(|| "N/A".to_string());
            let block_number = log_entry
                .blockNumber
                .clone()
                .map(|n| n.to_string())
                .unwrap_or_else(|| "N/A".to_string());
            let data = &log_entry.data;


            ic_cdk::println!("📋 Processing general log entry for Tx: {}", transaction_hash);

            let summary = format!(
                "Tx: {}, Block: {}, Data: {}",
                transaction_hash, block_number, data
            );
            ic_cdk::println!("➡ Processed log: {}", summary);
            log_strings.push(summary);
        }

        ic_cdk::println!("✅ fetch_logs completed successfully");

        Ok(log_strings)
    }

    fn convert_address(address: &str) -> String {
        // Remove the "0x" prefix and leading zeros
        let stripped_address = address
            .trim_start_matches("0x")
            .strip_prefix("000000000000000000000000")
            .unwrap_or(address.trim_start_matches("0x"));

        // Ensure it is 40 characters long (20 bytes)
        let padded_address = format!("{:0>40}", stripped_address);

        // Convert to mixed-case for Ethereum address format
        let mixed_case_address = format!("0x{}", padded_address);

        mixed_case_address
    }

    fn extract_amount(data: &str) -> u64 {
        // Logic to extract amount from the data
        // Assuming data is a hex string that contains the amount at a specific position
        if data.len() >= 132 {
            let hex_amount = &data[66..130]; // Extracting amount
            return u64::from_str_radix(hex_amount, 16).unwrap_or(0); // Convert hex to decimal
        }
        0 // Return 0 if data length is insufficient
    }

    fn extract_src_chain_id(data: &str) -> u64 {
        // Logic to extract src_chain_id from the data
        if data.len() >= 198 {
            let hex_src_chain_id = &data[130..194]; // Extracting src_chain_id
            return u64::from_str_radix(hex_src_chain_id, 16).unwrap_or(0); // Convert hex to decimal
        }
        0 // Return 0 if data length is insufficient
    }

    fn extract_dest_chain_id(data: &str) -> u64 {
        // Logic to extract dest_chain_id from the data
        if data.len() >= 258 {
            let hex_dest_chain_id = &data[194..258]; // Extracting dest_chain_id
            return u64::from_str_radix(hex_dest_chain_id, 16).unwrap_or(0); // Convert hex to decimal
        }
        0 // Return 0 if data length is insufficient
    }

    pub fn start_periodic_fetch(&self) {
        let service_clone = self.clone();

        let timer_id = set_timer_interval(std::time::Duration::from_secs(7), move || {
            let service_ref = service_clone.clone();

            // Spawn an async task to call fetch_logs_and_update_time
            // Note: ic_cdk::spawn is used for running async functions.
            ic_cdk::spawn(async move {
                service_ref.fetch_logs_and_update_time().await;
            });
        });

        // Save the timer id so you can cancel it later if needed
        *self.timer_id.borrow_mut() = Some(timer_id);

        ic_cdk::println!("Started periodic fetch_logs_and_update_time every 15 seconds");
    }


    pub async fn fetch_logs_and_update_time(&self) {
        ic_cdk::println!("start_monitoring.");

        // Read the last checked block number
        let from_block = BLOCK_NUMBER.with(|block_num: &RefCell<u64>| *block_num.borrow());
        ic_cdk::println!("Read BLOCK_NUMBER: {}", from_block);

        // Build RPC call
        ic_cdk::println!("About to call eth_get_block_by_number");

        let rpc_services = RpcServices::Custom {
            chainId: 17000,
            services: vec![RpcApi {
                url: "https://ethereum-holesky-rpc.publicnode.com".to_string(),
                headers: None,
            }],
        };

        let cycles = 8_000_000_000_000u128;

        // Only call once
        let result: Result<(MultiGetBlockByNumberResult,), _> =
            call_with_payment128::<(RpcServices, (), BlockTag), (MultiGetBlockByNumberResult,)>(
                self.evm_rpc.0,
                "eth_getBlockByNumber",
                (rpc_services, (), BlockTag::Latest),
                cycles,
            )
            .await;

        // Handle result in a single match
        let highest_block_number: u64 = match result {
            Ok((multi_result,)) => match multi_result {
                MultiGetBlockByNumberResult::Consistent(GetBlockByNumberResult::Ok(block)) => {
                    ic_cdk::println!("✅ Block result OK, extracting number");
                    Self::nat_to_u64(block.number)
                }
                MultiGetBlockByNumberResult::Consistent(GetBlockByNumberResult::Err(err)) => {
                    ic_cdk::println!("❌ Error inside block result: {:?}", err);
                    return;
                }
                MultiGetBlockByNumberResult::Inconsistent(providers) => {
                    ic_cdk::println!("⚠ Inconsistent provider response: {:?}", providers);
                    return;
                }
            },
            Err((code, msg)) => {
                ic_cdk::println!("❌ Canister call failed: {:?} - {}", code, msg);
                return;
            }
        };

        // Continue logic
        ic_cdk::println!(
            "highest_block_number: {}, from_block: {}",
            highest_block_number,
            from_block
        );

        let to_block = if highest_block_number > (from_block + 499) {
            from_block + 499
        } else {
            highest_block_number
        };
       
        // 8841826 > 8842202
        ic_cdk::println!(
            "Fetching logs from_block: {}, to_block: {}",
            from_block,
            to_block
        );

        BLOCK_NUMBER.with(|block_num| {
            *block_num.borrow_mut() = to_block;
        });

        if let Err(e) = self
            .fetch_token_locked_logs(
                from_block,
                to_block,
                Some("0xA41AfeA9F9f866Cd1853ba8c09A401c664688fD6".to_string()),
            )
            .await
        {
            ic_cdk::println!("Error fetching logs: {}", e);
            return;
        }

        ic_cdk::println!("✅ fetch_logs completed successfully");
    }

  
    pub fn nat_to_u64(nat: Nat) -> u64 {
        use num_traits::cast::ToPrimitive;
        nat.0
            .to_u64()
            .unwrap_or_else(|| ic_cdk::trap(&format!("Nat {} doesn't fit into a u64", nat)))
    }

    // TRANSACTION_MAP.with(|map| {
    //     let map = map.borrow();
    //     for (txn_hash, txn_details) in map.iter() {
    //         ic_cdk::println!(
    //             "Transaction Hash: {}, From: {}, To: {}, Amount: {}, Src Chain ID: {}, Dest Chain ID: {}, Block Number: {}",
    //             txn_hash,
    //             txn_details.from,
    //             txn_details.to,
    //             txn_details.amount,
    //             txn_details.src_chain_id,
    //             txn_details.dest_chain_id,
    //             txn_details.block_number
    //         );
    //     }
    // });
    fn clone(&self) -> Self {
        ChainService {
            canister_id: self.canister_id.clone(),
            evm_rpc: self.evm_rpc.clone(),
            last_checked_time: RefCell::new(*self.last_checked_time.borrow()),
            timer_id: RefCell::new(*self.timer_id.borrow()),
        }
    }
}



#[update]
pub fn update_block_number(new_block_num: u64) -> Result<String, String> {
    ic_cdk::println!("Updating block number to {}", new_block_num);
    BLOCK_NUMBER.with(|num| {
        *num.borrow_mut() = new_block_num;
    });
    Ok(format!("BLOCK_NUMBER updated to {}", new_block_num))
}

