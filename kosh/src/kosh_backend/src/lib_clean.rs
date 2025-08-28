use candid::{CandidType, Deserialize};
use ic_cdk::api::management_canister::http_request::{
    CanisterHttpRequestArgument, HttpHeader, HttpMethod, HttpResponse, TransformArgs,
};
use ic_cdk::api::management_canister::schnorr::{
    ManagementCanisterSchnorrPublicKeyRequest, ManagementCanisterSchnorrSignatureRequest,
    SchnorrAlgorithm, SchnorrKeyId,
};
use serde_json;
use std::str::FromStr;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use ic_cdk::caller;
use sha2::{Digest, Sha256};
use stellar_xdr::{
    Memo, MuxedAccount, Operation, OperationBody, PaymentOp, Preconditions, SequenceNumber, StringM, 
    Transaction, TransactionExt, Uint256, Uint64, WriteXdr, ReadXdr, Asset, AssetCode4, AssetCode12,
    ChangeTrustOp, Int64, Price, AlphabetizedClaimableBalanceId, ClaimPredicate, Claimant,
    CreateClaimableBalanceOp, Curve25519Public, DecoratedSignature, PublicKey, Signature,
    SignatureHint, TransactionEnvelope, TransactionSignaturePayload, TransactionSignaturePayloadTaggedTransaction,
    TransactionV1Envelope, Limits,
};

#[derive(CandidType, Deserialize)]
struct Func {
    principal: candid::Principal,
    method: String,
}

// Transform function for HTTP responses - required for cross-origin requests
fn transform_http_response(raw: TransformArgs) -> HttpResponse {
    let mut sanitized = raw.response.clone();
    
    // Remove headers that might cause issues
    sanitized.headers.retain(|header| {
        !header.name.to_lowercase().contains("date") &&
        !header.name.to_lowercase().contains("server")
    });
    
    sanitized
}

#[ic_cdk::query]
fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}

// Core function: Generate Stellar address from Internet Identity
#[ic_cdk::update]
async fn public_key_stellar() -> Result<String, String> {
    let request = ManagementCanisterSchnorrPublicKeyRequest {
        canister_id: None,
        derivation_path: vec![caller().as_slice().to_vec()],
        key_id: SchnorrKeyId {
            algorithm: SchnorrAlgorithm::Ed25519,
            name: "test_key_1".to_string(),
        },
    };

    let (res,): (ic_cdk::api::management_canister::schnorr::ManagementCanisterSchnorrPublicKeyResponse,) = 
        ic_cdk::call(candid::Principal::management_canister(), "schnorr_public_key", (request,))
            .await
            .map_err(|e| format!("Failed to call schnorr_public_key: {:?}", e))?;

    let public_key_bytes = res.public_key;
    let public_key_hex = hex::encode(&public_key_bytes);
    ic_cdk::println!("stellar_pub \"{}\"", public_key_hex);

    // Convert to Stellar address format
    let mut hasher = Sha256::new();
    hasher.update(&public_key_bytes);
    let hash = hasher.finalize();

    let mut payload = Vec::new();
    payload.push(6 << 3); // Version byte for account ID
    payload.extend_from_slice(&hash);

    // Calculate checksum
    let mut checksum_hasher = Sha256::new();
    checksum_hasher.update(&payload);
    let checksum = checksum_hasher.finalize();
    payload.extend_from_slice(&checksum[0..2]);

    // Encode in base32
    let address = base32::encode(base32::Alphabet::RFC4648 { padding: false }, &payload);
    
    ic_cdk::println!("Stellar address: {}", address);
    Ok(address)
}

// Core function: Sign Stellar transactions with threshold cryptography
#[ic_cdk::update]
async fn sign_transaction_stellar(xdr_base64: String, network: &str) -> Result<String, String> {
    let xdr_bytes = STANDARD.decode(&xdr_base64)
        .map_err(|e| format!("Failed to decode XDR: {}", e))?;
    
    // Parse the transaction envelope
    let mut envelope = TransactionEnvelope::from_xdr(&xdr_bytes, Limits::none())
        .map_err(|e| format!("Failed to parse transaction envelope: {}", e))?;
    
    // Get network passphrase
    let network_passphrase = match network {
        "mainnet" => "Public Global Stellar Network ; September 2015",
        "testnet" => "Test SDF Network ; September 2015",
        _ => return Err("Unsupported network".to_string()),
    };
    
    // Create signature payload
    let network_id = Sha256::digest(network_passphrase.as_bytes());
    let mut signature_payload = Vec::new();
    signature_payload.extend_from_slice(&network_id);
    signature_payload.extend_from_slice(&[0, 0, 0, 2]); // ENVELOPE_TYPE_TX
    
    // Add transaction hash
    let tx_hash = match &envelope {
        TransactionEnvelope::TxV0(env) => {
            let tx_v0 = &env.tx;
            let mut tx_bytes = Vec::new();
            tx_v0.write_xdr(&mut tx_bytes).map_err(|e| format!("Failed to serialize transaction: {}", e))?;
            Sha256::digest(&tx_bytes)
        },
        TransactionEnvelope::Tx(env) => {
            let tx_v1 = &env.tx;
            let mut tx_bytes = Vec::new();
            tx_v1.write_xdr(&mut tx_bytes).map_err(|e| format!("Failed to serialize transaction: {}", e))?;
            Sha256::digest(&tx_bytes)
        },
        TransactionEnvelope::TxFeeBump(_) => {
            return Err("Fee bump transactions not supported".to_string());
        }
    };
    signature_payload.extend_from_slice(&tx_hash);

    // Sign with threshold cryptography
    let request = ManagementCanisterSchnorrSignatureRequest {
        message: signature_payload.clone(),
        derivation_path: vec![caller().as_slice().to_vec()],
        key_id: SchnorrKeyId {
            algorithm: SchnorrAlgorithm::Ed25519,
            name: "test_key_1".to_string(),
        },
    };

    let (response,): (ic_cdk::api::management_canister::schnorr::ManagementCanisterSchnorrSignatureResponse,) = 
        ic_cdk::call(candid::Principal::management_canister(), "sign_with_schnorr", (request,))
            .await
            .map_err(|e| format!("Failed to sign: {:?}", e))?;

    let signature_bytes = response.signature;

    // Get public key for signature hint
    let public_key_result = public_key_stellar().await?;
    let public_key_bytes = hex::decode(
        public_key_result.chars()
            .filter(|c| c.is_ascii_hexdigit())
            .collect::<String>()
    ).map_err(|e| format!("Failed to decode public key hex: {}", e))?;

    // Create signature hint (last 4 bytes of public key)
    let hint_bytes = if public_key_bytes.len() >= 4 {
        public_key_bytes[public_key_bytes.len()-4..].to_vec()
    } else {
        vec![0, 0, 0, 0]
    };
    let signature_hint = SignatureHint(hint_bytes.try_into().unwrap_or([0, 0, 0, 0]));

    // Create decorated signature
    let decorated_signature = DecoratedSignature {
        hint: signature_hint,
        signature: Signature(signature_bytes.try_into().map_err(|_| "Invalid signature length")?),
    };

    // Add signature to envelope
    match &mut envelope {
        TransactionEnvelope::TxV0(env) => {
            env.signatures.push(decorated_signature).map_err(|_| "Failed to add signature")?;
        },
        TransactionEnvelope::Tx(env) => {
            env.signatures.push(decorated_signature).map_err(|_| "Failed to add signature")?;
        },
        TransactionEnvelope::TxFeeBump(_) => {
            return Err("Fee bump transactions not supported".to_string());
        }
    }

    // Serialize signed envelope
    let mut signed_xdr_bytes = Vec::new();
    envelope.write_xdr(&mut signed_xdr_bytes)
        .map_err(|e| format!("Failed to serialize signed envelope: {}", e))?;
    
    let signed_xdr_base64 = STANDARD.encode(&signed_xdr_bytes);
    Ok(signed_xdr_base64)
}

// Core function: Get sequence number for transaction building
async fn get_sequence_number(public_key: &str, network: &str) -> Result<i64, String> {
    let base_url = match network {
        "mainnet" => "https://horizon.stellar.org",
        _ => "https://horizon-testnet.stellar.org",
    };
    
    let url = format!("{}/accounts/{}", base_url, public_key);

    let response = ic_cdk::api::management_canister::http_request::http_request(
        CanisterHttpRequestArgument {
            url: url.clone(),
            method: HttpMethod::GET,
            body: None,
            max_response_bytes: Some(10_000),
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
        50_000_000_000,
    )
    .await
    .map_err(|(code, msg)| format!("HTTP request failed: code = {:?}, message = {}", code, msg))?;

    let response_body = String::from_utf8(response.0.body)
        .map_err(|e| format!("Failed to decode response body: {}", e))?;

    if response.0.status.to_string() == "404" {
        return Err("Account not found - please fund the account first".to_string());
    }

    let account: serde_json::Value = serde_json::from_str(&response_body)
        .map_err(|e| format!("Failed to parse JSON response: {}", e))?;

    let sequence_str = account["sequence"].as_str()
        .ok_or("Sequence number not found in response")?;
    
    let sequence = sequence_str.parse::<i64>()
        .map_err(|e| format!("Failed to parse sequence number: {}", e))?;

    Ok(sequence)
}

// Core function: Build and sign Stellar payment transactions
#[ic_cdk::update]
async fn build_stellar_transaction(
    destination_address: String,
    amount: u64,
    network: Option<String>,
) -> Result<String, String> {
    let network = network.as_deref().unwrap_or("testnet");
    
    // Get the source account (caller's Stellar address)
    let source_address = public_key_stellar().await?;
    
    // Get sequence number
    let sequence = get_sequence_number(&source_address, network).await?;
    let next_sequence = sequence + 1;

    // Decode source address
    let source_decoded = base32::decode(base32::Alphabet::RFC4648 { padding: false }, &source_address)
        .ok_or("Failed to decode source address")?;
    let source_account_id = if source_decoded.len() >= 32 {
        source_decoded[1..33].try_into().map_err(|_| "Invalid source address length")?
    } else {
        return Err("Invalid source address format".to_string());
    };

    // Decode destination address  
    let dest_decoded = base32::decode(base32::Alphabet::RFC4648 { padding: false }, &destination_address)
        .ok_or("Failed to decode destination address")?;
    let dest_account_id = if dest_decoded.len() >= 32 {
        dest_decoded[1..33].try_into().map_err(|_| "Invalid destination address length")?
    } else {
        return Err("Invalid destination address format".to_string());
    };

    // Create payment operation
    let payment_op = PaymentOp {
        destination: MuxedAccount::KeyTypeEd25519(Uint256(dest_account_id)),
        asset: Asset::Native,
        amount: Int64(amount as i64 * 10_000_000), // Convert to stroops
    };

    let operation = Operation {
        source_account: None,
        body: OperationBody::Payment(payment_op),
    };

    // Create transaction
    let transaction = Transaction {
        source_account: MuxedAccount::KeyTypeEd25519(Uint256(source_account_id)),
        fee: Uint32::new(100), // Base fee
        seq_num: SequenceNumber(next_sequence as u64),
        cond: Preconditions::None,
        memo: Memo::None,
        operations: vec![operation].try_into().map_err(|_| "Failed to create operations vector")?,
        ext: TransactionExt::V0,
    };

    // Create transaction envelope
    let tx_envelope = TransactionEnvelope::Tx(TransactionV1Envelope {
        tx: transaction,
        signatures: vec![].try_into().map_err(|_| "Failed to create signatures vector")?,
    });

    // Serialize to XDR
    let mut xdr_bytes = Vec::new();
    tx_envelope.write_xdr(&mut xdr_bytes)
        .map_err(|e| format!("Failed to serialize transaction: {}", e))?;
    
    let xdr_base64 = STANDARD.encode(&xdr_bytes);
    
    // Sign the transaction
    let signed_xdr = sign_transaction_stellar(xdr_base64, network).await?;
    
    // Submit to Stellar network
    let result = submit_transaction(signed_xdr, network).await?;
    
    Ok(result)
}

// Core function: Submit signed transactions to Stellar network
async fn submit_transaction(signed_xdr: String, network: &str) -> Result<String, String> {
    use ic_cdk::api::management_canister::http_request::{HttpHeader};
    use url::form_urlencoded;
    
    let base_url = match network {
        "mainnet" => "https://horizon.stellar.org",
        _ => "https://horizon-testnet.stellar.org",
    };
    
    let url = format!("{}/transactions", base_url);
    
    // Prepare form data
    let form_data: String = form_urlencoded::Serializer::new(String::new())
        .append_pair("tx", &signed_xdr)
        .finish();
    
    let headers = vec![
        HttpHeader {
            name: "Content-Type".to_string(),
            value: "application/x-www-form-urlencoded".to_string(),
        },
    ];

    let response = ic_cdk::api::management_canister::http_request::http_request(
        CanisterHttpRequestArgument {
            url: url.clone(),
            method: HttpMethod::POST,
            body: Some(form_data.into_bytes()),
            max_response_bytes: Some(50_000),
            transform: Some(ic_cdk::api::management_canister::http_request::TransformContext {
                function: ic_cdk::api::management_canister::http_request::TransformFunc(
                    Func {
                        principal: ic_cdk::id(),
                        method: "transform_http_response".to_string(),
                    }
                ),
                context: vec![],
            }),
            headers,
        },
        200_000_000_000,
    )
    .await
    .map_err(|(code, msg)| format!("HTTP request failed: code = {:?}, message = {}", code, msg))?;

    let response_body = String::from_utf8(response.0.body)
        .map_err(|e| format!("Failed to decode response body: {}", e))?;

    let status = response.0.status.to_string();
    
    if status == "200" {
        // Parse successful response
        let tx_response: serde_json::Value = serde_json::from_str(&response_body)
            .map_err(|e| format!("Failed to parse success response: {}", e))?;
            
        let hash = tx_response["hash"].as_str().unwrap_or("unknown");
        let ledger = tx_response["ledger"].as_u64().unwrap_or(0);
        
        let explorer_url = match network {
            "mainnet" => format!("https://stellar.expert/explorer/public/tx/{}", hash),
            _ => format!("https://stellar.expert/explorer/testnet/tx/{}", hash),
        };
        
        let success_response = serde_json::json!({
            "success": true,
            "hash": hash,
            "ledger": ledger,
            "explorer_url": explorer_url,
            "raw_response": response_body
        });
        
        Ok(success_response.to_string())
    } else {
        // Parse error response
        match serde_json::from_str::<serde_json::Value>(&response_body) {
            Ok(error_json) => {
                let error_msg = error_json["detail"].as_str()
                    .or(error_json["title"].as_str())
                    .unwrap_or("Unknown transaction error");
                    
                let error_response = serde_json::json!({
                    "success": false,
                    "error": error_msg,
                    "status": status,
                    "raw_response": response_body
                });
                
                Ok(error_response.to_string())
            },
            Err(_) => {
                let fallback_response = serde_json::json!({
                    "success": false,
                    "error": format!("Transaction failed with status {}", status),
                    "raw_response": response_body
                });
                Ok(fallback_response.to_string())
            }
        }
    }
}
