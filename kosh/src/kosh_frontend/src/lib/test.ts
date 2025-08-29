// import StellarSdk from "@stellar/stellar-sdk";
// import fetch from "node-fetch";

// const { Networks, TransactionBuilder, Operation, Account, BASE_FEE, Horizon } = StellarSdk;

// // --- CONFIG ---
// // Horizon (Testnet)
// const HORIZON_URL = "https://horizon-testnet.stellar.org";

// // Source account (public key only). Replace if you want a different account.
// const SOURCE_ACCOUNT_ID = "GAVDR2GPP5PSBWA5UMSUGNXG36CEV3DXAALW2TTVD5AB7KSVYJNCBDRG";

// // Contract + lock parameters (taken from your messages)
// const CONTRACT_ID = "CDTA5IYGUGRI4PAGXJL7TPBEIC3EZY6V23ILF5EDVXFVLCGGMVOK4CRL"; // used as from_token here
// const DEST_TOKEN = "eth";
// const IN_AMOUNT = "1000000000000000000"; // decimal string (i128)
// const DEST_CHAIN_ASCII = "holeksy"; // you earlier said "holeksy"
// const RECIPIENT_ADDRESS = "0x8Da1867ab5eE5385dc72f5901bC9Bd16F580d157";

// // If you'd rather use "holesky" change DEST_CHAIN_ASCII above to "holesky"

// // --- Helper to encode bytes hex if you want hex instead of ascii
// function stringToHexBytesStr(s) {
//   return Buffer.from(s, "utf8").toString("hex");
// }

// async function main() {
//   try {
//     // Setup Horizon server (use Horizon client via Stellar SDK)
//     // Note: In modern stellar-sdk, Horizon client is under Horizon.Server
//     const server = new Horizon.Server(HORIZON_URL);

//     // Fetch account info to get current sequence number
//     console.log("Fetching account info for:", SOURCE_ACCOUNT_ID);
//     const acctResp = await fetch(`${HORIZON_URL}/accounts/${SOURCE_ACCOUNT_ID}`);
//     if (!acctResp.ok) {
//       const txt = await acctResp.text().catch(() => "");
//       throw new Error(`Failed to fetch account from Horizon: ${acctResp.status} ${acctResp.statusText} ${txt}`);
//     }
//     const acctJson = await acctResp.json();
//     const seq = acctJson.sequencea;
//     if (!seq) throw new Error("Could not obtain account sequence from Horizon response.");

//     console.log("Account sequence:", seq);

//     // Build source Account object for TransactionBuilder (unsigned)
//     const sourceAccount = new Account(SOURCE_ACCOUNT_ID, seq);

//     // We will represent the lock function call as a set of manageData operations (metadata).
//     // This produces an unsigned transaction XDR you can sign or adapt later.
//     // NOTE: To make a true Soroban invokeHostFunction TX you would use Soroban hostfunction helpers.
//     const txBuilder = new TransactionBuilder(sourceAccount, {
//       fee: String(BASE_FEE),
//       networkPassphrase: Networks.TESTNET,
//     });

//     // Add a manageData entry for the contract id (from_token)
//     txBuilder.addOperation(
//       Operation.manageData({
//         name: "contract_id", // metadata key
//         value: CONTRACT_ID,
//       })
//     );

//     // Add a manageData entry for dest_token
//     txBuilder.addOperation(
//       Operation.manageData({
//         name: "dest_token",
//         value: DEST_TOKEN,
//       })
//     );

//     // Add a manageData entry for in_amount
//     txBuilder.addOperation(
//       Operation.manageData({
//         name: "in_amount",
//         value: IN_AMOUNT,
//       })
//     );

//     // Add a manageData entry for dest_chain (store ASCII)
//     txBuilder.addOperation(
//       Operation.manageData({
//         name: "dest_chain",
//         value: DEST_CHAIN_ASCII,
//       })
//     );

//     // Add a manageData entry for recipient address
//     txBuilder.addOperation(
//       Operation.manageData({
//         name: "recipient_address",
//         value: RECIPIENT_ADDRESS,
//       })
//     );

//     // Add an operation that marks intent to call 'lock' (purely descriptive)
//     txBuilder.addOperation(
//       Operation.manageData({
//         name: "intent",
//         value: "call_lock",
//       })
//     );

//     // Finalize transaction (unsigned)
//     const tx = txBuilder.setTimeout(180).build();

//     // Print unsigned XDR (base64)
//     console.log("\n--- Unsigned transaction XDR (base64) ---\n");
//     console.log(tx.toXDR());
//     console.log("\n--- End of XDR ---\n");

//     // Also print human-readable summary
//     console.log("Summary of encoded values:");
//     console.log("  source:", SOURCE_ACCOUNT_ID);
//     console.log("  contract_id (from_token):", CONTRACT_ID);
//     console.log("  dest_token:", DEST_TOKEN);
//     console.log("  in_amount:", IN_AMOUNT);
//     console.log("  dest_chain (ascii):", DEST_CHAIN_ASCII, " (hex:", stringToHexBytesStr(DEST_CHAIN_ASCII), ")");
//     console.log("  recipient_address:", RECIPIENT_ADDRESS);
//     console.log("\nNotes:");
//     console.log("- This is UNSIGNED. To submit it you must sign it (offline or with a signer).");
//     console.log("- To turn this into a real Soroban invokeHostFunction tx, replace the manageData ops with a proper InvokeHostFunction op (requires soroban-client helpers).");
//   } catch (err) {
//     console.error("Error:", err.message || err);
//   }
// }

// main();