use ic_cdk::api::management_canister::http_request::{
    HttpHeader, HttpMethod, HttpResponse, CanisterHttpRequestArgument
};
use serde::{Deserialize, Serialize};
use stellar_xdr::curr;
use std::cell::RefCell;
use std::collections::HashMap;
use candid::CandidType;
use hex;
use std::str::FromStr;

use crate::eth::send_eth_evm;




// Contract ID we want to fetch events for
const CONTRACT_ID: &str = "CDTA5IYGUGRI4PAGXJL7TPBEIC3EZY6V23ILF5EDVXFVLCGGMVOK4CRL";
// RPC endpoint URL
const RPC_URL: &str = "https://soroban-testnet.stellar.org";

// Store events in memory
thread_local! {
    static EVENTS: RefCell<HashMap<String, CandidContractEvent>> = RefCell::new(HashMap::new());
}

// Request structure for the JSON-RPC call
#[derive(Serialize, Debug)]
struct GetEventsRequest {
    jsonrpc: String,
    id: u32,
    method: String,
    params: GetEventsParams,
}

#[derive(Serialize, Debug)]
struct GetEventsParams {
    #[serde(rename = "startLedger")]
    start_ledger: u32,
    #[serde(rename = "xdrFormat")]
    xdr_format: String,
    filters: Vec<EventFilter>,
    pagination: PaginationOptions,
}

#[derive(Serialize, Debug)]
struct EventFilter {
    #[serde(rename = "type")]
    filter_type: String,
    #[serde(rename = "contractIds")]
    contract_ids: Vec<String>,
    topics: Vec<String>,
}

#[derive(Serialize, Debug)]
struct PaginationOptions {
    limit: u32,
}

// Response structures for the JSON-RPC result
#[derive(Deserialize, Debug, Clone)]
struct RpcResponse {
    id: u32,
    result: EventsResponse,
}

#[derive(Deserialize, Debug, Clone)]
struct EventsResponse {
    events: Vec<ContractEvent>,
    latest_ledger: u32,
}

#[derive(Deserialize, Debug, Clone)]
struct ContractEvent {
    contract_id: String,
    id: String,
    ledger: u32,
    topic: Vec<String>,
    value: EventValue,
    paging_token: String,
}

#[derive(Deserialize, Debug, Clone)]
struct EventValue {
    xdr: String,
}

// Candid-compatible types for the interface
#[derive(Debug, Clone, CandidType)]
pub struct CandidContractEvent {
    pub contract_id: String,
    pub id: String,
    pub ledger: u32,
    pub topic: Vec<String>,
    pub xdr_value: String,
    pub paging_token: String,
}

impl From<ContractEvent> for CandidContractEvent {
    fn from(event: ContractEvent) -> Self {
        CandidContractEvent {
            contract_id: event.contract_id,
            id: event.id,
            ledger: event.ledger,
            topic: event.topic,
            xdr_value: event.value.xdr,
            paging_token: event.paging_token,
        }
    }
}

// Define the transform function for HTTP responses





#[derive(Serialize, Debug)]
struct GetLatestLedgerRequest {
    jsonrpc: String,
    id: u32,
    method: String,
}

async fn fetch_latest_ledger() -> Result<u32, String> {
    let request = GetLatestLedgerRequest {
        jsonrpc: "2.0".to_string(),
        id: 8675309,
        method: "getLatestLedger".to_string(),
    };

    let request_body = serde_json::to_string(&request)
        .map_err(|e| format!("Failed to serialize request: {}", e))?;

    let request_headers = vec![
        HttpHeader {
            name: "Content-Type".to_string(),
            value: "application/json".to_string(),
        },
    ];

    let request_arg = CanisterHttpRequestArgument {
        url: RPC_URL.to_string(),
        method: HttpMethod::POST,
        body: Some(request_body.into_bytes()),
        max_response_bytes: Some(2_000_000),
        transform: None,
        headers: request_headers,
    };

    let result = ic_cdk::api::management_canister::http_request::http_request(
        request_arg,
        50_000_000_000,
    )
    .await;

    let (response,): (HttpResponse,) = match result {
        Ok(res) => res,
        Err((rejection_code, message)) => {
            return Err(format!("HTTP request failed with code {:?}: {}", rejection_code, message));
        }
    };

    let response_body = String::from_utf8(response.body)
        .map_err(|e| format!("Failed to decode response body: {}", e))?;

    ic_cdk::println!("Latest ledger response: {}", response_body);

    let json_value: serde_json::Value = serde_json::from_str(&response_body)
        .map_err(|e| format!("Failed to parse JSON response: {}", e))?;

    if let Some(result) = json_value.get("result") {
        if let Some(sequence) = result.get("sequence").and_then(|s| s.as_u64()) {
            ic_cdk::println!("Latest ledger sequence: {}", sequence);
            return Ok(sequence as u32);
        }
    }

    Err("Failed to extract ledger sequence from response".to_string())
}

#[ic_cdk::update]
async fn fetch_stellar_events(ledger: u32) -> Result<String, String> {
    ic_cdk::println!("Starting stellar events monitoring");
    
    let contract_id = CONTRACT_ID.to_string();
    ic_cdk::println!("Contract ID: {}", contract_id);

    let mut current_ledger = ledger; // Starting ledger
    let mut result_summary = String::new();
    
    loop {
        // Get the latest ledger in each iteration
        let latest_ledger = match fetch_latest_ledger().await {
            Ok(ledger) => ledger,
            Err(e) => {
                ic_cdk::println!("Error fetching latest ledger: {}", e);
                
                continue;
            }
        };
        
     
       if current_ledger <= latest_ledger {
        
        let request = GetEventsRequest {
            jsonrpc: "2.0".to_string(),
            id: 8675309,
            method: "getEvents".to_string(),
            params: GetEventsParams {
                start_ledger: current_ledger,
                xdr_format: "json".to_string(),
                filters: vec![EventFilter {
                    filter_type: "contract".to_string(),
                    contract_ids: vec![contract_id.clone()],
                    topics: vec![],
                }],
                pagination: PaginationOptions {
                    limit: 1000,
                },
            },
        };
        
        let request_body = serde_json::to_string(&request)
            .map_err(|e| format!("Failed to serialize request: {}", e))?;
        ic_cdk::println!("Request body: {}", request_body);
        
        let request_headers = vec![
            HttpHeader {
                name: "Content-Type".to_string(),
                value: "application/json".to_string(),
            },
        ];
        
        let request_arg = CanisterHttpRequestArgument {
            url: RPC_URL.to_string(),
            method: HttpMethod::POST,
            body: Some(request_body.into_bytes()),
            max_response_bytes: Some(2_000_000),
            transform: None,
            headers: request_headers,
        };
        
        match ic_cdk::api::management_canister::http_request::http_request(
            request_arg,
            50_000_000_000,
        )
        .await {
            Ok((response,)) => {

                if let Ok(response_body) = String::from_utf8(response.body.clone()) {
                    if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(&response_body) {
                        if let Some(result) = json_value.get("result") {
                            ic_cdk::println!("Result: {:?}", result);
                            if let Some(events) = result.get("events") {
                                ic_cdk::println!("Events: {:?}", events);
                                if let Some(events_array) = events.as_array() {
                                    if !events_array.is_empty() {
                                        result_summary.push_str(&format!("\n=== Events for Ledger {} ===\n", current_ledger));
                                        
                                        for event in events_array {
                                            ic_cdk::println!("\n=== EVENT DETAILS ===");
                                            ic_cdk::println!("Transaction Hash: {}", event.get("txHash").and_then(|v| v.as_str()).unwrap_or("N/A"));
                                            ic_cdk::println!("Event ID: {}", event.get("id").and_then(|v| v.as_str()).unwrap_or("N/A"));
                                            
                                            if let Some(value_json) = event.get("valueJson") {
                                                if let Some(map) = value_json.get("map").and_then(|m| m.as_array()) {
                                                    let mut dest_address = String::new();
                                                    let mut amount_to_send: f64 = 0.0;
                                                    let mut dest_chain: u64 = 0;

                                                    for item in map {
                                                        if let Some(key) = item.get("key").and_then(|k| k.get("symbol")).and_then(|s| s.as_str()) {
                                                            match key {
                                                                "dest_chain" => {
                                                                    if let Some(bytes) = item.get("val").and_then(|v| v.get("bytes")).and_then(|b| b.as_str()) {
                                                                        if let Ok(decimal) = u64::from_str_radix(bytes, 16) {
                                                                            ic_cdk::println!("Destination Chain: {}", decimal);
                                                                            dest_chain = decimal;
                                                                        }
                                                                    }
                                                                },
                                                                "dest_token" => {
                                                                    if let Some(token) = item.get("val").and_then(|v| v.get("string")).and_then(|s| s.as_str()) {
                                                                        ic_cdk::println!("Destination Token: {}", token);
                                                                    }
                                                                },
                                                                "from_token" => {
                                                                    if let Some(addr) = item.get("val").and_then(|v| v.get("address")).and_then(|s| s.as_str()) {
                                                                        ic_cdk::println!("From Token: {}", addr);
                                                                    }
                                                                },
                                                                "in_amount" => {
                                                                    if let Some(amount) = item.get("val").and_then(|v| v.get("i128")).and_then(|i| i.get("lo")) {
                                                                        let amount_val = amount.as_u64().unwrap_or(0);
                                                                        ic_cdk::println!("Input Amount: {} XLM (raw: {})", amount_val as f64 / 10_000_000.0, amount_val);
                                                                        amount_to_send = amount_val as f64;
                                                                    }
                                                                },
                                                                "recipient_address" => {
                                                                    if let Some(addr) = item.get("val").and_then(|v| v.get("string")).and_then(|s| s.as_str()) {
                                                                        ic_cdk::println!("Destination Address: {}", addr);
                                                                        dest_address = addr.to_string();
                                                                    }
                                                                },
                                                                _ => {}
                                                            }
                                                        }
                                                    }

                                                    // Send ETH if we have all required values
                                                    if !dest_address.is_empty() && amount_to_send > 0.0 && dest_chain > 0 {
                                                        ic_cdk::println!("Sending ETH to: {}", dest_address);
                                                        ic_cdk::println!("Amount: {}", amount_to_send);
                                                        ic_cdk::println!("Chain: {}", dest_chain);
                                                        if let Err(e) = send_eth_evm(dest_address, 0.01 as f64, dest_chain.to_string()).await {
                                                            ic_cdk::println!("Error sending ETH: {}", e);
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            Err((code, msg)) => {
                ic_cdk::println!("HTTP request failed: code = {:?}, message = {}", code, msg);
            }
        }

        // Increment current ledger
        current_ledger += 1;
        
    }

    }



}

// Query function to get stored events
#[ic_cdk::query]
fn get_events() -> Vec<CandidContractEvent> {
    EVENTS.with(|events| {
        events.borrow()
            .values()
            .cloned()
            .collect()
    })
}

// Query function to get a specific event by ID
#[ic_cdk::query]
fn get_event_by_id(id: String) -> Option<CandidContractEvent> {
    EVENTS.with(|events| {
        events.borrow()
            .get(&id)
            .cloned()
    })
}
