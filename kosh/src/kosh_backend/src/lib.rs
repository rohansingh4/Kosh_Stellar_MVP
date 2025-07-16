use base32::Alphabet;
use candid::{CandidType, Principal};
use crc16::{State, XMODEM};
use serde::{Deserialize, Serialize};
use std::convert::TryInto;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use ic_cdk::api::management_canister::http_request::{
    CanisterHttpRequestArgument, HttpMethod,
};
use serde_json;
use sha2::{Digest, Sha256};
use stellar_xdr::curr::{
    DecoratedSignature, Hash, Limited, Limits, ReadXdr, Signature,
    TransactionEnvelope, TransactionSignaturePayload, TransactionSignaturePayloadTaggedTransaction,
    WriteXdr,
};

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
            name: String::from("dfx_test_key"),
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

async fn sign_transaction_stellar(xdr_base64: String) -> Result<String, String> {
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
        // Use testnet network passphrase
        let network_passphrase = "Test SDF Network ; September 2015";
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
                name: String::from("dfx_test_key"),
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
                name: String::from("dfx_test_key"),
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
        let result = submit_transaction(signed_xdr_base64.clone()).await?;
        ic_cdk::println!("Transaction submission result: {}", result);
        Ok(signed_xdr_base64)
    } else {
        Err("Invalid transaction envelope type".to_string())
    }
}

async fn get_sequence_number(public_key: &str) -> Result<i64, String> {
    let url = format!(
        "https://horizon-testnet.stellar.org/accounts/{}",
        public_key
    );

    let response = ic_cdk::api::management_canister::http_request::http_request(
        CanisterHttpRequestArgument {
            url: url.clone(),
            method: HttpMethod::GET,
            body: None,
            max_response_bytes: Some(10_000),
            transform: None,
            headers: vec![],
        },
        50_000_000_000, // cycles
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
async fn build_stellar_transaction(
    destination_address: String,
    amount: u64,
) -> Result<String, String> {
    use stellar_xdr::curr::{
        Asset, Memo, MuxedAccount, Operation, OperationBody, PaymentOp, Preconditions,
        SequenceNumber, TimeBounds, TimePoint, Transaction, TransactionExt, TransactionV1Envelope,
        Uint256,
    };

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
    let sequence = get_sequence_number(&source_address).await?;
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
    let stroops_amount = (amount * 10_000_000) as i64;

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
    let result = sign_transaction_stellar(xdr_base64.clone()).await?;
    ic_cdk::println!("Transaction submission result: {}", result);
    Ok(xdr_base64)
}

async fn submit_transaction(signed_xdr: String,) -> Result<String, String> {
    use ic_cdk::api::management_canister::http_request::{HttpHeader};
    use url::form_urlencoded;

    // Clean the XDR and URL encode it
    let clean_xdr = signed_xdr.trim().replace(" ", "");
    let encoded_xdr = form_urlencoded::byte_serialize(clean_xdr.as_bytes()).collect::<String>();
    
    ic_cdk::println!("Clean XDR before submission: {}", clean_xdr);

    // Prepare the request body in the format Horizon expects
    let request_body = format!("tx={}", encoded_xdr);
    
    ic_cdk::println!("Request body: {}", request_body);

    // Make HTTP request to Stellar testnet
    let response = ic_cdk::api::management_canister::http_request::http_request(
        CanisterHttpRequestArgument {
            url: "https://horizon-testnet.stellar.org/transactions".to_string(),
            method: HttpMethod::POST,
            body: Some(request_body.into_bytes()),
            max_response_bytes: Some(10_000),
            transform: None,
            headers: vec![HttpHeader {
                name: "Content-Type".to_string(),
                value: "application/x-www-form-urlencoded".to_string(),
            }],
        },
        50_000_000_000, // cycles
    )
    .await
    .map_err(|(code, msg)| format!("HTTP request failed: code = {:?}, message = {}", code, msg))?;

    // Parse and return the response
    let response_body = String::from_utf8(response.0.body)
        .map_err(|e| format!("Failed to decode response body: {}", e))?;

    ic_cdk::println!("Transaction submission response: {}", response_body);
    
    Ok(response_body)
}

#[ic_cdk::update]
async fn get_account_balance() -> Result<String, String> {
    // Get the user's Stellar address
    let address = public_key_stellar().await?;
    
    let url = format!(
        "https://horizon-testnet.stellar.org/accounts/{}",
        address
    );

    let response = ic_cdk::api::management_canister::http_request::http_request(
        CanisterHttpRequestArgument {
            url: url.clone(),
            method: HttpMethod::GET,
            body: None,
            max_response_bytes: Some(10_000),
            transform: None,
            headers: vec![],
        },
        50_000_000_000, // cycles
    )
    .await
    .map_err(|(code, msg)| format!("HTTP request failed: code = {:?}, message = {}", code, msg))?;

    let response_body = String::from_utf8(response.0.body)
        .map_err(|e| format!("Failed to decode response body: {}", e))?;

    if response.0.status.to_string() == "404" {
        return Ok("Account not found (unfunded)".to_string());
    }

    let account: serde_json::Value = serde_json::from_str(&response_body)
        .map_err(|e| format!("Failed to parse JSON response: {}", e))?;

    // Find the native XLM balance
    if let Some(balances) = account["balances"].as_array() {
        for balance in balances {
            if balance["asset_type"].as_str() == Some("native") {
                if let Some(balance_amount) = balance["balance"].as_str() {
                    return Ok(format!("{} XLM", balance_amount));
                }
            }
        }
    }

    Ok("No XLM balance found".to_string())
}
