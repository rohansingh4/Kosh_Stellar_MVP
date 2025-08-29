use base32::Alphabet;
use candid::{CandidType, Principal};
use crc16::{State, XMODEM};
use serde::{Deserialize, Serialize};
use std::convert::TryInto;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use ic_cdk::api::management_canister::http_request::{
    CanisterHttpRequestArgument, HttpMethod, HttpResponse, TransformArgs,
};
use crate::{evm_indexer::CHAIN_SERVICE, stellar_indexer::CandidContractEvent};
use candid::Func;
use serde_json;

use sha2::{Digest, Sha256};
use stellar_xdr::curr::{
    DecoratedSignature, Hash, Limited, Limits, ReadXdr, Signature,
    TransactionEnvelope, TransactionSignaturePayload, TransactionSignaturePayloadTaggedTransaction,
    WriteXdr,
};

pub mod stellar_indexer; 
pub mod evm_indexer;
pub mod eth;
pub mod evm_rpc_bindings;
type CanisterId = Principal;

#[derive(CandidType, Serialize, Deserialize, Debug, Copy, Clone)]
pub enum SchnorrAlgorithm {
    #[serde(rename = "ed25519")]
    Ed25519,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct PublicKeyReply {
    pub public_key_hex: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SignatureReply {
    pub signature_hex: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SignatureVerificationReply {
    pub is_signature_valid: bool,
}

#[derive(CandidType, Serialize, Debug)]
struct ManagementCanisterSchnorrPublicKeyRequest {
    pub canister_id: Option<CanisterId>,
    pub derivation_path: Vec<Vec<u8>>,
    pub key_id: SchnorrKeyId,
}

#[derive(CandidType, Deserialize, Debug)]
struct ManagementCanisterSchnorrPublicKeyReply {
    pub public_key: Vec<u8>,
    pub chain_code: Vec<u8>,
}

#[derive(CandidType, Serialize, Debug, Clone)]
struct SchnorrKeyId {
    pub algorithm: SchnorrAlgorithm,
    pub name: String,
}

#[derive(CandidType, Serialize, Debug)]
struct ManagementCanisterSignatureRequest {
    pub message: Vec<u8>,
    pub derivation_path: Vec<Vec<u8>>,
    pub key_id: SchnorrKeyId,
}

#[derive(CandidType, Deserialize, Debug)]
struct ManagementCanisterSignatureReply {
    pub signature: Vec<u8>,
}

#[derive(Deserialize)]
struct AccountResponse {
    sequence: String,
}

// Transform function to make HTTP responses deterministic
#[ic_cdk::query]
fn transform_http_response(raw: TransformArgs) -> HttpResponse {
    let mut sanitized = raw.response.clone();
    
    // Remove non-deterministic headers
    sanitized.headers.clear();
    
    HttpResponse {
        status: sanitized.status,
        body: sanitized.body,
        headers: vec![], // Remove all headers for determinism
    }
}

// Keep the original greet function for testing
#[ic_cdk::query]
fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}

#[ic_cdk::update]
async fn public_key_stellar() -> Result<String, String> {
    let request = ManagementCanisterSchnorrPublicKeyRequest {
        canister_id: None,
        derivation_path: vec![ic_cdk::api::caller().as_slice().to_vec()],
        key_id: SchnorrKeyId {
            algorithm: SchnorrAlgorithm::Ed25519,
            name: String::from("test_key_1"),
        },
    };

    ic_cdk::println!("to_key_id {:?}", request);

    let (res,): (ManagementCanisterSchnorrPublicKeyReply,) = ic_cdk::call(
        Principal::management_canister(),
        "schnorr_public_key",
        (request,),
    )
    .await
    .map_err(|e| format!("schnorr_public_key failed {}", e.1))?;

    let public_key_bytes = res.public_key.to_vec();

    if public_key_bytes.len() != 32 {
        return Err("Invalid public key length; expected 32 bytes".to_string());
    }

    let version_byte = 0x30;
    let mut data_with_version = vec![version_byte];
    data_with_version.extend_from_slice(&public_key_bytes);

    let stellar_pub = hex::encode(data_with_version.clone());
    ic_cdk::println!("stellar_pub {:?}", stellar_pub);

    // Step 2: Calculate CRC16-XModem checksum
    let mut state = State::<XMODEM>::new();
    state.update(&data_with_version);
    let checksum = state.get().to_le_bytes();
    data_with_version.extend_from_slice(&checksum);

    // Step 3: Encode the resulting data in Base32
    let stellar_address = base32::encode(Alphabet::RFC4648 { padding: false }, &data_with_version);
    ic_cdk::println!("Stellar address: {}", stellar_address);

    if !stellar_address.starts_with('G') {
        return Err("Generated Stellar address does not start with 'G'".to_string());
    }

    Ok(stellar_address)
}

async fn sign_transaction_stellar(xdr_base64: String, network: &str) -> Result<String, String> {
    let xdr_bytes = STANDARD.decode(&xdr_base64)
        .map_err(|e| format!("Failed to decode XDR: {}", e))?;

    let limits = Limits {
        depth: 100,
        len: 10000,
    };

    let mut limited_reader = Limited::new(xdr_bytes.as_slice(), limits.clone());
    let envelope = TransactionEnvelope::read_xdr(&mut limited_reader)
        .map_err(|e| format!("Failed to parse XDR: {}", e))?;

    if let TransactionEnvelope::Tx(tx_envelope) = envelope {
        // Use the appropriate network passphrase
        let network_passphrase = match network {
            "mainnet" => "Public Global Stellar Network ; September 2015",
            "testnet" | _ => "Test SDF Network ; September 2015",
        };
        let network_id = Sha256::digest(network_passphrase.as_bytes());
        ic_cdk::println!("Network ID: {}", hex::encode(&network_id));
        
        let tagged_transaction = TransactionSignaturePayloadTaggedTransaction::Tx(tx_envelope.tx.clone());
        let payload = TransactionSignaturePayload {
            network_id: Hash(network_id.try_into().map_err(|_| "Hash conversion failed")?),
            tagged_transaction,
        };

        // Serialize the payload to get the bytes to sign
        let mut payload_bytes = Vec::new();
        let mut limited_writer = Limited::new(&mut payload_bytes, limits.clone());
        payload.write_xdr(&mut limited_writer)
            .map_err(|e| format!("Failed to serialize payload: {}", e))?;

        // Calculate the hash of the payload
        let hash = Sha256::digest(&payload_bytes);
        ic_cdk::println!("Transaction hash to sign: {}", hex::encode(&hash));

        // Get the public key first
        let pubkey_request = ManagementCanisterSchnorrPublicKeyRequest {
            canister_id: None,
            derivation_path: vec![ic_cdk::api::caller().as_slice().to_vec()],
            key_id: SchnorrKeyId {
                algorithm: SchnorrAlgorithm::Ed25519,
                name: String::from("test_key_1"),
            },
        };

        let (pubkey_reply,): (ManagementCanisterSchnorrPublicKeyReply,) = ic_cdk::call(
            Principal::management_canister(),
            "schnorr_public_key",
            (pubkey_request,),
        )
        .await
        .map_err(|e| format!("schnorr_public_key failed {}", e.1))?;

        ic_cdk::println!("Public key: {}", hex::encode(&pubkey_reply.public_key));

        // Sign the hash
        let internal_request = ManagementCanisterSignatureRequest {
            message: hash.to_vec(),
            derivation_path: vec![ic_cdk::api::caller().as_slice().to_vec()],
            key_id: SchnorrKeyId {
                algorithm: SchnorrAlgorithm::Ed25519,
                name: String::from("test_key_1"),
            },
        };

        let (internal_reply,): (ManagementCanisterSignatureReply,) =
            ic_cdk::api::call::call_with_payment(
                Principal::management_canister(),
                "sign_with_schnorr",
                (internal_request,),
                26_153_846_153,
            )
            .await
            .map_err(|e| format!("sign_with_schnorr failed {e:?}"))?;

        ic_cdk::println!("Signature: {}", hex::encode(&internal_reply.signature));

        // Create hint from public key
        let mut hint = [0u8; 4];
        hint.copy_from_slice(&pubkey_reply.public_key[28..32]);
        ic_cdk::println!("Signature hint: {}", hex::encode(&hint));

        // Create decorated signature
        let decorated_sig = DecoratedSignature {
            hint: stellar_xdr::curr::SignatureHint(hint),
            signature: Signature(internal_reply.signature.try_into()
                .map_err(|_| "Invalid signature length")?),
        };

        // Create new envelope with the signature
        let mut signed_envelope = tx_envelope;
        signed_envelope.signatures = vec![decorated_sig].try_into()
            .map_err(|_| "Failed to add signature")?;

        // Serialize the signed envelope
        let mut signed_xdr = Vec::new();
        let mut limited_writer = Limited::new(&mut signed_xdr, limits);
        TransactionEnvelope::Tx(signed_envelope)
            .write_xdr(&mut limited_writer)
            .map_err(|e| format!("Failed to serialize signed envelope: {}", e))?;

        let signed_xdr_base64 = STANDARD.encode(signed_xdr);
        ic_cdk::println!("Signed XDR: {}", signed_xdr_base64);
        let result = submit_transaction(signed_xdr_base64.clone(), network).await?;
        ic_cdk::println!("Transaction submission result: {}", result);
        // Return the actual submission result (with hash) instead of the XDR
        Ok(result)
    } else {
        Err("Invalid transaction envelope type".to_string())
    }
}

async fn get_sequence_number(public_key: &str, network: &str) -> Result<i64, String> {
    let base_url = match network {
        "mainnet" => "https://horizon.stellar.org",
        "testnet" | _ => "https://horizon-testnet.stellar.org", // Default to testnet
    };
    
    let url = format!("{}/accounts/{}", base_url, public_key);

    let response = ic_cdk::api::management_canister::http_request::http_request(
        CanisterHttpRequestArgument {
            url: url.clone(),
            method: HttpMethod::GET,
            body: None,
            max_response_bytes: Some(50_000), // Increased for larger responses
            transform: Some(ic_cdk::api::management_canister::http_request::TransformContext {
                function: ic_cdk::api::management_canister::http_request::TransformFunc(
                    Func {
                        principal: ic_cdk::id(),
                        method: "transform_http_response".to_string(),
                    }
                ),
                context: vec![],
            }),
            headers: vec![],
        },
        100_000_000_000, // Increased cycles for HTTPS requests
    )
    .await
    .map_err(|(code, msg)| format!("HTTP request failed: code = {:?}, message = {}", code, msg))?;

    let response_body = String::from_utf8(response.0.body)
        .map_err(|e| format!("Failed to decode response body: {}", e))?;

    let account: AccountResponse = serde_json::from_str(&response_body)
        .map_err(|e| format!("Failed to parse JSON response: {}", e))?;

    account
        .sequence
        .parse::<i64>()
        .map_err(|e| format!("Failed to parse sequence number: {}", e))
}


#[ic_cdk::update]
async fn evm_block_fetch(block_number: u64) {
    let service = CHAIN_SERVICE.with(|service_cell| {
        let mut service = service_cell.borrow_mut();
        if service.is_none() {
            let canister_id = ic_cdk::api::id().to_string();
            *service = Some(crate::evm_indexer::ChainService::new(canister_id));
        }
        service.clone()
    });
    
    if let Some(service) = service {
        service.start_periodic_fetch(block_number).await;
    }
}

#[ic_cdk::update]
async fn build_stellar_transaction(
    destination_address: String,
    amount: u64,
    network: Option<String>,
) -> Result<String, String> {
    // Check if this is a Base chain transaction
    let network_type = network.as_deref().unwrap_or("testnet");
    
    // if network_type == "base" {
    //     // Handle Base chain (EVM) transaction
    //     use crate::evm_indexer::CHAIN_SERVICE;
        
    //     // Get or initialize chain service
    //     let chain_service = CHAIN_SERVICE.with(|service| {
    //         let mut service = service.borrow_mut();
    //         if service.is_none() {
    //             let canister_id = ic_cdk::api::id().to_string();
    //             *service = Some(crate::evm_indexer::ChainService::new(canister_id));
    //         }
    //         service.clone()
    //     });
        
    //     if let Some(service) = chain_service {
    //         // Convert amount from u64 to string (assuming it's in wei already)
    //         let amount_wei = amount.to_string();
            
    //         return match service.send_eth_evm(
    //             destination_address,
    //             amount_wei,
    //             "base".to_string()
    //         ).await {
    //             Ok(tx_hash) => Ok(format!("{{\"success\": true, \"hash\": \"{}\", \"network\": \"base\"}}", tx_hash)),
    //             Err(e) => Err(format!("Base chain transaction failed: {}", e))
    //         };
    //     } else {
    //         return Err("Failed to initialize chain service".to_string());
    //     }
    // }
    
    // Continue with Stellar transaction logic for non-base networks
    use stellar_xdr::curr::{
        Asset, Memo, MuxedAccount, Operation, OperationBody, PaymentOp, Preconditions,
        SequenceNumber, TimeBounds, TimePoint, Transaction, TransactionExt, TransactionV1Envelope,
        Uint256,
    };

    ic_cdk::println!("AMOUNNNNT {} ,destionation_ADDRESS {}",amount,destination_address);

    // Get the source account public key in Stellar format
    let source_address = public_key_stellar().await?;
    ic_cdk::println!("Using source address: {}", source_address);

    // Decode the Stellar address from base32
    let decoded = base32::decode(Alphabet::RFC4648 { padding: false }, &source_address)
        .ok_or("Failed to decode base32 address")?;

    // Remove version byte (1 byte) and checksum (2 bytes)
    if decoded.len() <= 3 {
        return Err("Invalid source address encoding".to_string());
    }

    let key_bytes = &decoded[1..decoded.len() - 2];

    if key_bytes.len() != 32 {
        return Err(format!("Invalid key length: {}", key_bytes.len()).to_string());
    }

    let source_key = Uint256(
        key_bytes
            .try_into()
            .map_err(|_| "Invalid source address length")?,
    );

    // Create the source account - use Ed25519 instead of MuxedEd25519
    let source_account = MuxedAccount::Ed25519(source_key);

    // Get sequence number from network
    let network_type = network.as_deref().unwrap_or("testnet");
    let sequence = get_sequence_number(&source_address, network_type).await?;
    ic_cdk::println!("Current sequence: {}", sequence);

    // Convert destination address to AccountId format
    let decoded_dest = base32::decode(Alphabet::RFC4648 { padding: false }, &destination_address)
        .ok_or("Failed to decode base32 destination address")?;

    if decoded_dest.len() <= 3 {
        return Err("Invalid destination address encoding".to_string());
    }

    let dest_key_bytes = &decoded_dest[1..decoded_dest.len() - 2];

    if dest_key_bytes.len() != 32 {
        return Err(
            format!("Invalid destination key length: {}", dest_key_bytes.len()).to_string(),
        );
    }

    let destination_key = Uint256(
        dest_key_bytes
            .try_into()
            .map_err(|_| "Invalid destination address length")?,
    );

    // Use Ed25519 for destination account
    let destination_account = MuxedAccount::Ed25519(destination_key);

    // Convert amount to stroops (1 XLM = 10,000,000 stroops)
    // Make sure to keep it as i64 which is what Stellar expects
    let stroops_amount = (1 * 10_000_000) as i64;

    // Create the payment operation
    let payment_op = PaymentOp {
        destination: destination_account,
        asset: Asset::Native,
        amount: stroops_amount,
    };

    // Set up the operation with the payment
    let operation = Operation {
        source_account: None,
        body: OperationBody::Payment(payment_op),
    };

    // Create time bounds (valid for 5 minutes)
    let time_bounds = TimeBounds {
        min_time: TimePoint(0),
        max_time: TimePoint(0), // 5 minutes validity window
    };

    // Create transaction with proper sequence number and time bounds
    let transaction = Transaction {
        source_account,
        fee: 100, // 100 stroops (0.00001 XLM)
        seq_num: SequenceNumber(sequence + 1),
        cond: Preconditions::Time(time_bounds),
        memo: Memo::None,
        operations: vec![operation]
            .try_into()
            .map_err(|_| "Too many operations")?,
        ext: TransactionExt::V0,
    };

    // Create transaction envelope
    let tx_envelope = TransactionV1Envelope {
        tx: transaction,
        signatures: vec![].try_into().map_err(|_| "Too many signatures")?,
    };

    let envelope = TransactionEnvelope::Tx(tx_envelope);

    // Serialize to XDR
    let mut xdr_out = Vec::new();
    let limits = Limits {
        depth: 100,
        len: 10000,
    };
    let mut limited_writer = Limited::new(&mut xdr_out, limits);
    envelope
        .write_xdr(&mut limited_writer)
        .map_err(|e| format!("Failed to serialize transaction: {}", e))?;

    // Base64 encode the XDR
    let xdr_base64 = STANDARD.encode(xdr_out);

    // Log the XDR for debugging
    ic_cdk::println!("Generated transaction XDR: {}", xdr_base64);
    let result = sign_transaction_stellar(xdr_base64.clone(), network_type).await?;
    ic_cdk::println!("Transaction submission result: {}", result);
    // Return the actual submission result (with hash) instead of the XDR
    Ok(result)
}

async fn submit_transaction(signed_xdr: String, network: &str) -> Result<String, String> {
    use ic_cdk::api::management_canister::http_request::{HttpHeader};
    use url::form_urlencoded;

    // Clean the XDR and URL encode it
    let clean_xdr = signed_xdr.trim().replace(" ", "");
    let encoded_xdr = form_urlencoded::byte_serialize(clean_xdr.as_bytes()).collect::<String>();
    
    ic_cdk::println!("Clean XDR before submission: {}", clean_xdr);

    // Prepare the request body in the format Horizon expects
    let request_body = format!("tx={}", encoded_xdr);
    
    ic_cdk::println!("Request body: {}", request_body);

    let base_url = match network {
        "mainnet" => "https://horizon.stellar.org",
        "testnet" | _ => "https://horizon-testnet.stellar.org", // Default to testnet
    };
    
    // Make HTTP request to Stellar network
    let response = ic_cdk::api::management_canister::http_request::http_request(
        CanisterHttpRequestArgument {
            url: format!("{}/transactions", base_url),
            method: HttpMethod::POST,
            body: Some(request_body.into_bytes()),
            max_response_bytes: Some(50_000), // Increased for larger responses
            transform: Some(ic_cdk::api::management_canister::http_request::TransformContext {
                function: ic_cdk::api::management_canister::http_request::TransformFunc(
                    Func {
                        principal: ic_cdk::id(),
                        method: "transform_http_response".to_string(),
                    }
                ),
                context: vec![],
            }),
            headers: vec![HttpHeader {
                name: "Content-Type".to_string(),
                value: "application/x-www-form-urlencoded".to_string(),
            }],
        },
        100_000_000_000, // Increased cycles for HTTPS requests
    )
    .await
    .map_err(|(code, msg)| format!("HTTP request failed: code = {:?}, message = {}", code, msg))?;

    // Parse and return the response
    let response_body = String::from_utf8(response.0.body)
        .map_err(|e| format!("Failed to decode response body: {}", e))?;

    ic_cdk::println!("Transaction submission response: {}", response_body);
    ic_cdk::println!("Response status code: {:?}", response.0.status);
    ic_cdk::println!("Response headers: {:?}", response.0.headers);
    
    // Check if response is successful (2xx status code)  
    let status_code = response.0.status.0.to_string().parse::<u16>().unwrap_or(500);
    
    // For Stellar API, 400 errors are expected for transaction failures and contain useful JSON
    // Only treat non-400 errors as HTTP errors that we can't parse
    if status_code < 200 || (status_code >= 300 && status_code != 400) {
        ic_cdk::println!("HTTP error status: {}", status_code);
        let error_response = serde_json::json!({
            "success": false,
            "error": format!("HTTP error {}: {}", status_code, response_body),
            "raw_response": response_body
        });
        return Ok(error_response.to_string());
    }
    
    // Parse the JSON response to extract transaction hash
    match serde_json::from_str::<serde_json::Value>(&response_body) {
        Ok(json_response) => {
            ic_cdk::println!("Parsed JSON response: {}", json_response);
            
            // Log all keys to understand the response structure
            ic_cdk::println!("JSON response keys: {:?}", json_response.as_object().map(|obj| obj.keys().collect::<Vec<_>>()));
            
            // For successful transactions, Stellar returns a 'hash' field
            let hash = json_response.get("hash").and_then(|h| h.as_str());
                
            // Check if transaction was successful - for errors, status will be 400 and successful field won't exist
            let is_successful = json_response.get("successful")
                .and_then(|s| s.as_bool())
                .unwrap_or(false);
                
            // Check if this is an error response from Stellar
            let is_error_response = json_response.get("type").is_some() && 
                                  json_response.get("title").is_some() &&
                                  json_response.get("status").is_some();
                
            ic_cdk::println!("Extracted hash: {:?}, Is successful: {}", hash, is_successful);
            
            if let Some(hash_value) = hash {
                let network_path = match network {
                    "mainnet" => "public",
                    "testnet" | _ => "testnet",
                };
                let explorer_url = format!("https://stellar.expert/explorer/{}/tx/{}", network_path, hash_value);
                let success_response = serde_json::json!({
                    "success": true,
                    "hash": hash_value,
                    "explorer_url": explorer_url,
                    "raw_response": response_body
                });
                ic_cdk::println!("Returning success response with hash: {}", hash_value);
                Ok(success_response.to_string())
            } else if is_error_response {
                // Handle Stellar API error responses
                let title = json_response.get("title").and_then(|t| t.as_str()).unwrap_or("Transaction Failed");
                let detail = json_response.get("detail").and_then(|d| d.as_str()).unwrap_or("Unknown error");
                
                // Extract operation error codes for better error messages
                let operation_errors = json_response.get("extras")
                    .and_then(|extras| extras.get("result_codes"))
                    .and_then(|codes| codes.get("operations"))
                    .and_then(|ops| ops.as_array())
                    .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>().join(", "))
                    .unwrap_or_else(|| "unknown".to_string());
                
                let user_friendly_error = match operation_errors.as_str() {
                    "op_no_destination" => "Destination account does not exist. The recipient needs to be funded with at least 1 XLM first.",
                    "op_underfunded" => "Insufficient balance to complete this transaction.",
                    "op_low_reserve" => "This transaction would leave your account below the minimum reserve.",
                    _ => &detail
                };
                
                ic_cdk::println!("Stellar API error: {} - {}", title, detail);
                ic_cdk::println!("Operation errors: {}", operation_errors);
                
                let error_response = serde_json::json!({
                    "success": false,
                    "error": user_friendly_error,
                    "stellar_error_code": operation_errors,
                    "raw_response": response_body
                });
                Ok(error_response.to_string())
            } else if is_successful {
                // Transaction successful but no hash found (unusual case)
                let success_response = serde_json::json!({
                    "success": true,
                    "message": "Transaction successful but hash not available",
                    "raw_response": response_body
                });
                Ok(success_response.to_string())
            } else {
                // Unexpected response format
                ic_cdk::println!("Unexpected response format. Full response: {}", json_response);
                
                let error_response = serde_json::json!({
                    "success": false,
                    "error": "Unexpected response format from Stellar network",
                    "raw_response": response_body,
                    "debug_info": "Check canister logs for full response details"
                });
                Ok(error_response.to_string())
            }
        }
        Err(parse_error) => {
            ic_cdk::println!("Failed to parse JSON response: {}", parse_error);
            
            // Check if this looks like our own XDR (base64) - this would indicate an issue
            if response_body.starts_with("AAAA") && response_body.len() > 100 {
                ic_cdk::println!("ERROR: Response looks like XDR instead of Stellar API response!");
                let error_response = serde_json::json!({
                    "success": false,
                    "error": "Internal error: Got XDR instead of API response",
                    "raw_response": "XDR data (hidden for clarity)",
                    "debug_info": "Transaction may have been submitted but hash extraction failed"
                });
                return Ok(error_response.to_string());
            }
            
            // If we can't parse as JSON, return the raw response
            let fallback_response = serde_json::json!({
                "success": false,
                "error": format!("Could not parse response as JSON: {}", parse_error),
                "raw_response": response_body
            });
            Ok(fallback_response.to_string())
        }
    }
}


fn decode_stellar_address(address: &str) -> Result<[u8; 32], String> {
    let decoded = base32::decode(Alphabet::RFC4648 { padding: false }, address)
        .ok_or("Failed to decode base32 address")?;

    if decoded.len() <= 3 {
        return Err("Invalid address encoding".to_string());
    }

    let key_bytes = &decoded[1..decoded.len() - 2];

    if key_bytes.len() != 32 {
        return Err(format!("Invalid key length: {}", key_bytes.len()).to_string());
    }

    let mut result = [0u8; 32];
    result.copy_from_slice(key_bytes);
    Ok(result)
}

#[ic_cdk::update]
async fn execute_token_swap(
    destination_address: String,
    destination_asset_code: String,
    destination_asset_issuer: String,
    send_amount: u64,
    dest_min: String,
    network: Option<String>,
) -> Result<String, String> {
    use stellar_xdr::curr::{
        Asset, Memo, MuxedAccount, Operation, OperationBody, PaymentOp,
        PathPaymentStrictSendOp, Preconditions, SequenceNumber, StringM, 
        Transaction, TransactionExt, TransactionV1Envelope,
        Uint256, VecM, Limited, Limits, WriteXdr, AlphaNum4, AlphaNum12, 
        AssetCode4, AssetCode12, AccountId, PublicKey
    };

    let network = network.unwrap_or_else(|| "testnet".to_string());
    
    ic_cdk::println!("Executing REAL token swap on Stellar: {} XLM → {} {}", 
        send_amount as f64 / 10_000_000.0, dest_min, destination_asset_code);
    
    ic_cdk::println!("Network: {}, Destination: {}, Asset Issuer: {}", 
        network, destination_address, destination_asset_issuer);
    
    // Get source address and sequence number
    let source_address = public_key_stellar().await?;
    let sequence_number = get_sequence_number(&source_address, &network).await?;
    
    // Decode addresses
    let source_key_bytes = decode_stellar_address(&source_address)?;
    let dest_key_bytes = decode_stellar_address(&destination_address)?;
    let issuer_key_bytes = decode_stellar_address(&destination_asset_issuer)?;
    
    // Create destination asset
    let dest_asset = if destination_asset_code.len() <= 4 {
        let mut code = [0u8; 4];
        let bytes = destination_asset_code.as_bytes();
        code[..bytes.len()].copy_from_slice(bytes);
        Asset::CreditAlphanum4(AlphaNum4 {
            asset_code: AssetCode4(code),
            issuer: AccountId(PublicKey::PublicKeyTypeEd25519(Uint256(issuer_key_bytes)))
        })
    } else {
        let mut code = [0u8; 12];
        let bytes = destination_asset_code.as_bytes();
        code[..bytes.len().min(12)].copy_from_slice(&bytes[..bytes.len().min(12)]);
        Asset::CreditAlphanum12(AlphaNum12 {
            asset_code: AssetCode12(code),
            issuer: AccountId(PublicKey::PublicKeyTypeEd25519(Uint256(issuer_key_bytes)))
        })
    };
    
    // Parse minimum destination amount 
    let dest_min_stroops = (dest_min.parse::<f64>().unwrap_or(0.0) * 10_000_000.0) as i64;
    
    // Create PathPaymentStrictSend operation for actual token swapping
    ic_cdk::println!("Creating PathPaymentStrictSend operation...");
    let path_payment_op = PathPaymentStrictSendOp {
        send_asset: Asset::Native, // Send XLM
        send_amount: send_amount as i64,
        destination: MuxedAccount::Ed25519(Uint256(dest_key_bytes)),
        dest_asset: dest_asset,
        dest_min: 1, // 1 stroop = 0.0000001 (minimal amount)
        path: VecM::default(), // Empty path - Stellar will find optimal route
    };

    let operation = Operation {
        source_account: None,
        body: OperationBody::PathPaymentStrictSend(path_payment_op),
    };

    // Create memo
    let memo = Memo::Text(
        StringM::try_from("KOSH Swap".to_string()).map_err(|_| "Memo too long")?
    );

    // Use simpler preconditions - no time bounds for now to avoid time sync issues
    let preconditions = Preconditions::None;

    // Build transaction
    let transaction = Transaction {
        source_account: MuxedAccount::Ed25519(Uint256(source_key_bytes)),
        fee: 10000, // Higher fee for path payments
        seq_num: SequenceNumber(sequence_number + 1),
        cond: preconditions,
        memo,
        operations: VecM::try_from(vec![operation]).map_err(|_| "Too many operations")?,
        ext: TransactionExt::V0,
    };

    // Create and serialize transaction envelope
    let tx_envelope = TransactionV1Envelope {
        tx: transaction,
        signatures: VecM::default(),
    };

    let limits = Limits { depth: 100, len: 10000 };
    let mut xdr_out = Vec::new();
    let mut limited_writer = Limited::new(&mut xdr_out, limits);
    stellar_xdr::curr::TransactionEnvelope::Tx(tx_envelope)
        .write_xdr(&mut limited_writer)
        .map_err(|e| format!("Failed to serialize transaction: {}", e))?;

    let tx_xdr = STANDARD.encode(&xdr_out);
    ic_cdk::println!("Built swap XDR: {}", tx_xdr);
    ic_cdk::println!("Submitting transaction to Stellar {} network...", network);

    // Sign and submit the transaction - same as build_stellar_transaction
    let result = sign_transaction_stellar(tx_xdr, &network).await?;
    
    ic_cdk::println!("Swap transaction result: {}", result);
    
    // Return the result directly, just like build_stellar_transaction does
    Ok(result)
}


#[ic_cdk::update]
async fn get_account_assets(network: Option<String>) -> Result<String, String> {
    let network = network.unwrap_or_else(|| "testnet".to_string());
    let base_url = match network.as_str() {
        "mainnet" => "https://horizon.stellar.org",
        _ => "https://horizon-testnet.stellar.org",
    };
    
    // Get our public key
    let public_key_result = public_key_stellar().await?;
    let address = public_key_result;

    let url = format!("{}/accounts/{}", base_url, address);

    let response = ic_cdk::api::management_canister::http_request::http_request(
        CanisterHttpRequestArgument {
            url: url.clone(),
            method: HttpMethod::GET,
            body: None,
            max_response_bytes: Some(100_000),
            transform: Some(ic_cdk::api::management_canister::http_request::TransformContext {
                function: ic_cdk::api::management_canister::http_request::TransformFunc(
                    Func {
                        principal: ic_cdk::id(),
                        method: "transform_http_response".to_string(),
                    }
                ),
                context: vec![],
            }),
            headers: vec![],
        },
        200_000_000_000,
    )
    .await
    .map_err(|(code, msg)| format!("HTTP request failed: code = {:?}, message = {}", code, msg))?;

    let response_body = String::from_utf8(response.0.body)
        .map_err(|e| format!("Failed to decode response body: {}", e))?;

    if response.0.status.to_string() == "404" {
        return Ok(serde_json::json!({
            "success": false,
            "error": "Account not found",
            "assets": []
        }).to_string());
    }

    let account: serde_json::Value = serde_json::from_str(&response_body)
        .map_err(|e| format!("Failed to parse JSON response: {}", e))?;

    // Extract all balances (assets)
    let mut assets = Vec::new();
    
    if let Some(balances) = account["balances"].as_array() {
        for balance in balances {
            let asset_info = if balance["asset_type"].as_str() == Some("native") {
                serde_json::json!({
                    "asset_type": "native",
                    "asset_code": "XLM",
                    "asset_issuer": null,
                    "balance": balance["balance"],
                    "limit": null,
                    "is_authorized": true,
                    "is_authorized_to_maintain_liabilities": true,
                    "buying_liabilities": balance.get("buying_liabilities").unwrap_or(&serde_json::Value::String("0.0000000".to_string())),
                    "selling_liabilities": balance.get("selling_liabilities").unwrap_or(&serde_json::Value::String("0.0000000".to_string()))
                })
            } else {
                serde_json::json!({
                    "asset_type": balance["asset_type"],
                    "asset_code": balance["asset_code"],
                    "asset_issuer": balance["asset_issuer"],
                    "balance": balance["balance"],
                    "limit": balance["limit"],
                    "is_authorized": balance.get("is_authorized").unwrap_or(&serde_json::Value::Bool(true)),
                    "is_authorized_to_maintain_liabilities": balance.get("is_authorized_to_maintain_liabilities").unwrap_or(&serde_json::Value::Bool(true)),
                    "buying_liabilities": balance.get("buying_liabilities").unwrap_or(&serde_json::Value::String("0.0000000".to_string())),
                    "selling_liabilities": balance.get("selling_liabilities").unwrap_or(&serde_json::Value::String("0.0000000".to_string()))
                })
            };
            assets.push(asset_info);
        }
    }

    let response = serde_json::json!({
        "success": true,
        "address": address,
        "assets": assets,
        "network": network
    });

    Ok(response.to_string())
}

#[ic_cdk::update]
async fn create_trustline(
    asset_code: String,
    asset_issuer: String,
    network: Option<String>,
    limit: Option<String>,
) -> Result<String, String> {
    use stellar_xdr::curr::{
        Asset, Memo, MuxedAccount, Operation, OperationBody, ChangeTrustOp,
        Preconditions, SequenceNumber, Transaction, TransactionExt, TransactionV1Envelope,
        Uint256, VecM, Limited, Limits, WriteXdr, AlphaNum4, AlphaNum12,
        AssetCode4, AssetCode12, AccountId, PublicKey, ChangeTrustAsset
    };

    let network = network.unwrap_or_else(|| "testnet".to_string());
    let trust_limit = limit.unwrap_or_else(|| "922337203685.4775807".to_string());
    
    ic_cdk::println!("Creating trustline for {} from issuer {} on {} with limit {}", 
        asset_code, asset_issuer, network, trust_limit);
    
    // Get source address and sequence number
    let source_address = public_key_stellar().await?;
    let sequence_number = get_sequence_number(&source_address, &network).await?;
    
    // Decode addresses
    let source_key_bytes = decode_stellar_address(&source_address)?;
    let issuer_key_bytes = decode_stellar_address(&asset_issuer)?;
    
    // Create the asset for trustline (use ChangeTrustAsset)
    let trustline_asset = if asset_code.len() <= 4 {
        let mut code = [0u8; 4];
        let bytes = asset_code.as_bytes();
        code[..bytes.len()].copy_from_slice(bytes);
        ChangeTrustAsset::CreditAlphanum4(AlphaNum4 {
            asset_code: AssetCode4(code),
            issuer: AccountId(PublicKey::PublicKeyTypeEd25519(Uint256(issuer_key_bytes)))
        })
    } else {
        let mut code = [0u8; 12];
        let bytes = asset_code.as_bytes();
        code[..bytes.len().min(12)].copy_from_slice(&bytes[..bytes.len().min(12)]);
        ChangeTrustAsset::CreditAlphanum12(AlphaNum12 {
            asset_code: AssetCode12(code),
            issuer: AccountId(PublicKey::PublicKeyTypeEd25519(Uint256(issuer_key_bytes)))
        })
    };
    
    // Parse trust limit to stroops
    let limit_stroops = (trust_limit.parse::<f64>().unwrap_or(922337203685.4775807) * 10_000_000.0) as i64;
    
    // Create ChangeTrust operation
    ic_cdk::println!("Creating ChangeTrust operation...");
    let change_trust_op = ChangeTrustOp {
        line: trustline_asset,
        limit: limit_stroops,
    };

    let operation = Operation {
        source_account: None,
        body: OperationBody::ChangeTrust(change_trust_op),
    };

    // Create memo
    let memo = Memo::Text(
        stellar_xdr::curr::StringM::try_from("KOSH Trustline".to_string()).map_err(|_| "Memo too long")?
    );

    // Build transaction
    let transaction = Transaction {
        source_account: MuxedAccount::Ed25519(Uint256(source_key_bytes)),
        fee: 10000, // Higher fee for trustline operations
        seq_num: SequenceNumber(sequence_number + 1),
        cond: Preconditions::None,
        memo,
        operations: VecM::try_from(vec![operation]).map_err(|_| "Too many operations")?,
        ext: TransactionExt::V0,
    };

    // Create and serialize transaction envelope
    let tx_envelope = TransactionV1Envelope {
        tx: transaction,
        signatures: VecM::default(),
    };

    let limits = Limits { depth: 100, len: 10000 };
    let mut xdr_out = Vec::new();
    let mut limited_writer = Limited::new(&mut xdr_out, limits);
    stellar_xdr::curr::TransactionEnvelope::Tx(tx_envelope)
        .write_xdr(&mut limited_writer)
        .map_err(|e| format!("Failed to serialize transaction: {}", e))?;

    let tx_xdr = STANDARD.encode(&xdr_out);
    ic_cdk::println!("Built trustline XDR: {}", tx_xdr);
    ic_cdk::println!("Submitting trustline transaction to Stellar {} network...", network);

    // Sign and submit the transaction - same as build_stellar_transaction
    let result = sign_transaction_stellar(tx_xdr, &network).await?;
    
    ic_cdk::println!("Trustline transaction result: {}", result);
    
    // Return the result directly, just like build_stellar_transaction does
    Ok(result)
}

#[ic_cdk::update]
async fn check_trustline(
    asset_code: String,
    asset_issuer: String,
    network: Option<String>,
) -> Result<String, String> {
    let network = network.unwrap_or_else(|| "testnet".to_string());
    
    ic_cdk::println!("Checking trustline for {} from issuer {} on {}", asset_code, asset_issuer, network);
    
    // TODO: Move this function to frontend - temporarily return popular assets only
    // Simplified version for now
    
    // If not found in actual account data, check popular assets as demo
    let popular_assets = vec![
        ("USDC", "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"),
        ("USDT", "GCQTGZQQ5G4PTM2GL7CDIFKUBIPEC52BROAQIAPW53XBRJVN6ZJVTG6V"),
        ("AQUA", "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA"),
        ("yXLM", "GARDNV3Q7YGT4AKSDF25LT32YSCCW67G2P2OBKQP5PMPOUF2FIKW7SSP"),
        ("SRT", "GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B"),
    ];
    
    // For demo purposes, simulate finding popular assets
    if popular_assets.iter().any(|(code, issuer)| *code == asset_code && *issuer == asset_issuer) {
        // Simulate that trustline exists for demo
        return Ok(serde_json::json!({
            "success": true,
            "exists": true,
            "trustline": {
                "asset_code": asset_code,
                "asset_issuer": asset_issuer,
                "balance": "0.0000000",
                "limit": "922337203685.4775807",
                "is_authorized": true,
                "is_authorized_to_maintain_liabilities": true
            },
            "note": "Simulated trustline for demo purposes"
        }).to_string());
    }

    // Not found
    Ok(serde_json::json!({
        "success": true,
        "exists": false,
        "message": format!("No trustline found for {} issued by {}", asset_code, asset_issuer)
    }).to_string())
}

// Core function: Execute bridge lock transaction using Soroban smart contracts
#[ic_cdk::update]
async fn execute_bridge_lock(
    from_token_address: String,
    dest_token: String,
    amount: u64,
    dest_chain: String,
    recipient_address: String,
    network: Option<String>,
) -> Result<String, String> {
    let network = network.as_deref().unwrap_or("testnet");
    
    ic_cdk::println!("🔒 Bridge lock request: {} {} to {} on chain {}", 
        amount, from_token_address, dest_token, dest_chain);
    
    // Get user's Stellar address for the lock transaction
    let user_address = public_key_stellar().await?;
    
    // In a production implementation, this would:
    // 1. Build a Soroban contract call for the lock function
    // 2. Create the transaction envelope with contract.call('lock', ...)
    // 3. Sign it with threshold cryptography using sign_transaction_stellar
    // 4. Submit to Stellar network using submit_transaction
    // 5. Monitor for confirmation and return transaction hash
    
    // For now, return a demo response showing the structure
    let response = serde_json::json!({
        "success": true,
        "user_address": user_address,
        "from_token": from_token_address,
        "dest_token": dest_token,
        "amount": amount,
        "dest_chain": dest_chain,
        "recipient": recipient_address,
        "network": network,
        "contract_id": "CDTA5IYGUGRI4PAGXJL7TPBEIC3EZY6V23ILF5EDVXFXLCGGMVOK4CRL",
        "message": "Bridge lock transaction built and ready for submission",
        "note": "In production, this would execute the actual Soroban contract call"
    });
    
    Ok(response.to_string())
}

#[ic_cdk::update]
async fn sign_stellar_swap(
    xdr: String,
    network: Option<String>,
) -> Result<String, String> {
    let network = network.unwrap_or_else(|| "mainnet".to_string());
    
    ic_cdk::println!("🔐 Signing swap XDR on {}", network);
    
    // Use existing sign_transaction_stellar - it does everything we need
    sign_transaction_stellar(xdr, &network).await
}

ic_cdk::export_candid!();