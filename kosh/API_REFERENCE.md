# Kosh API Reference

## Overview

This document provides comprehensive API reference for all Kosh wallet interfaces including backend canister methods, frontend hooks, and integration examples.

## Backend Canister API

### Base URL
- **Local Development**: `http://localhost:4943`
- **IC Mainnet**: `https://ic0.app`

### Canister ID
- **Local**: `uxrrr-q7777-77774-qaaaq-cai` (auto-generated)
- **Production**: TBD (set during mainnet deployment)

---

## Authentication & Identity

### `greet(name: text) -> text`

**Type**: Query

**Description**: Test function to verify canister connectivity.

**Parameters**:
- `name` (text): Name to greet

**Returns**: Greeting message

**Example**:
```javascript
const result = await actor.greet("Alice");
// Returns: "Hello, Alice!"
```

---

## Stellar Operations

### `public_key_stellar() -> Result`

**Type**: Update

**Description**: Generates or retrieves the caller's Stellar public address using threshold cryptography.

**Authentication**: Required (uses caller's Internet Identity principal)

**Parameters**: None

**Returns**:
```candid
type Result = variant { Ok : text; Err : text };
```

**Success Response**:
```json
{
  "Ok": "GDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
}
```

**Error Responses**:
```json
{
  "Err": "Invalid public key length; expected 32 bytes"
}
```

```json
{
  "Err": "Generated Stellar address does not start with 'G'"
}
```

**Implementation Details**:
- Uses caller's principal as derivation path: `[ic_cdk::api::caller().as_slice().to_vec()]`
- Generates Ed25519 public key via IC management canister
- Converts to Stellar address format with version byte `0x30`
- Adds CRC16-XModem checksum and Base32 encoding
- Result is deterministic (same principal always generates same address)

**Usage Example**:
```javascript
try {
  const result = await actor.public_key_stellar();
  if (result.Ok) {
    console.log("Stellar Address:", result.Ok);
    // Store address for future use
    localStorage.setItem('stellar_address', result.Ok);
  } else {
    console.error("Error:", result.Err);
  }
} catch (error) {
  console.error("Call failed:", error);
}
```

**Performance**: ~2-3 seconds (first call), ~100ms (subsequent calls with caching)

**Cycles Cost**: ~26B cycles for signature generation

---

### `get_account_balance() -> Result`

**Type**: Update

**Description**: Retrieves the account balance from Stellar network for the caller's address.

**Authentication**: Required

**Parameters**: None

**Returns**:
```candid
type Result = variant { Ok : text; Err : text };
```

**Success Responses**:
```json
{
  "Ok": "1000.5000000 XLM"
}
```

```json
{
  "Ok": "Account not found (unfunded)"
}
```

**Error Responses**:
```json
{
  "Err": "HTTP request failed: code = Some(404), message = Not Found"
}
```

```json
{
  "Err": "Failed to parse JSON response: expected value at line 1 column 1"
}
```

**Implementation Details**:
- Automatically derives caller's Stellar address
- Makes HTTP outcall to Horizon API: `https://horizon-testnet.stellar.org/accounts/{address}`
- Parses account data and extracts native XLM balance
- Handles unfunded accounts gracefully
- Returns balance in human-readable format

**Usage Example**:
```javascript
const checkBalance = async () => {
  try {
    const result = await actor.get_account_balance();
    if (result.Ok) {
      if (result.Ok.includes("not found")) {
        console.log("Account needs funding");
        return "0.0000000 XLM";
      } else {
        console.log("Balance:", result.Ok);
        return result.Ok;
      }
    } else {
      throw new Error(result.Err);
    }
  } catch (error) {
    console.error("Balance check failed:", error);
    throw error;
  }
};
```

**Performance**: ~1-2 seconds (depends on Horizon API response time)

**Cycles Cost**: ~50B cycles for HTTP outcall

---

### `build_stellar_transaction(destination: text, amount: nat64) -> Result`

**Type**: Update

**Description**: Builds, signs, and submits a Stellar payment transaction.

**Authentication**: Required

**Parameters**:
- `destination` (text): Target Stellar address (G-prefixed, 56 characters)
- `amount` (nat64): Amount in whole XLM units (e.g., 10 = 10 XLM)

**Returns**:
```candid
type Result = variant { Ok : text; Err : text };
```

**Success Response**:
```json
{
  "Ok": "{\"_links\":{\"transaction\":{\"href\":\"https://horizon-testnet.stellar.org/transactions/abc123...\"}},\"hash\":\"abc123...\",\"ledger\":12345,\"envelope_xdr\":\"AAAAAgAA...\"}"
}
```

**Error Responses**:
```json
{
  "Err": "Invalid destination address encoding"
}
```

```json
{
  "Err": "HTTP request failed: insufficient balance"
}
```

```json
{
  "Err": "Failed to serialize transaction: invalid operation"
}
```

**Implementation Details**:
1. **Address Validation**: Validates destination address format and checksum
2. **Sequence Retrieval**: Gets current sequence number from Horizon API
3. **Transaction Building**: Creates XDR payment transaction with:
   - Source: Caller's derived address
   - Destination: Provided address
   - Amount: Converted from XLM to stroops (1 XLM = 10,000,000 stroops)
   - Fee: 100 stroops (0.00001 XLM)
   - Network: Testnet ("Test SDF Network ; September 2015")
4. **Signing**: Uses IC threshold cryptography to sign transaction hash
5. **Submission**: Posts signed XDR to Horizon transactions endpoint

**Usage Example**:
```javascript
const sendPayment = async (destination, amount) => {
  try {
    // Validate inputs
    if (!destination || !amount) {
      throw new Error("Destination and amount required");
    }
    
    if (!destination.match(/^G[A-Z2-7]{55}$/)) {
      throw new Error("Invalid Stellar address format");
    }
    
    const amountBigInt = BigInt(Math.floor(parseFloat(amount)));
    if (amountBigInt <= 0) {
      throw new Error("Amount must be positive");
    }
    
    // Call backend
    const result = await actor.build_stellar_transaction(
      destination, 
      amountBigInt
    );
    
    if (result.Ok) {
      const response = JSON.parse(result.Ok);
      return {
        success: true,
        transactionHash: response.hash,
        transactionLink: response._links.transaction.href,
        details: response
      };
    } else {
      throw new Error(result.Err);
    }
  } catch (error) {
    console.error("Transaction failed:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Usage
const result = await sendPayment(
  "GDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "10.5"
);

if (result.success) {
  console.log("Transaction submitted:", result.transactionHash);
} else {
  console.error("Transaction failed:", result.error);
}
```

**Performance**: ~5-8 seconds (includes signing and network submission)

**Cycles Cost**: ~100B cycles (signing + HTTP outcalls)

---

## Frontend JavaScript API

### `useAuth()` Hook

**Description**: React hook for authentication and wallet operations.

**Returns**:
```typescript
interface AuthHookResult {
  // Authentication State
  isAuthenticated: boolean;
  principal: Principal | null;
  actor: ActorSubclass | null;
  loading: boolean;
  
  // Wallet State
  walletLoading: boolean;
  stellarAddress: { stellar_address: string } | null;
  
  // Methods
  login(): Promise<void>;
  logout(): Promise<void>;
  getStellarAddress(): Promise<{ stellar_address: string }>;
  buildAndSubmitTransaction(destination: string, amount: string): Promise<TransactionResult>;
  getAccountBalance(): Promise<string>;
}
```

#### Authentication Methods

##### `login()`

**Description**: Initiates Internet Identity authentication flow.

**Returns**: `Promise<void>`

**Usage**:
```javascript
const { login, isAuthenticated, loading } = useAuth();

const handleLogin = async () => {
  try {
    await login();
    console.log("Login successful");
  } catch (error) {
    console.error("Login failed:", error);
  }
};
```

**Behavior**:
- Opens Internet Identity authentication dialog
- Supports WebAuthn/FIDO2 devices
- Creates authenticated canister actor on success
- Automatically generates Stellar address for new users

##### `logout()`

**Description**: Logs out user and clears authentication state.

**Returns**: `Promise<void>`

**Usage**:
```javascript
const { logout } = useAuth();

const handleLogout = async () => {
  try {
    await logout();
    console.log("Logged out successfully");
  } catch (error) {
    console.error("Logout failed:", error);
  }
};
```

**Behavior**:
- Calls Internet Identity logout
- Clears all authentication state
- Removes cached addresses from localStorage
- Resets actor to null

#### Wallet Methods

##### `getStellarAddress()`

**Description**: Gets or generates user's Stellar address.

**Returns**: `Promise<{ stellar_address: string }>`

**Usage**:
```javascript
const { getStellarAddress } = useAuth();

const loadAddress = async () => {
  try {
    const address = await getStellarAddress();
    console.log("Address:", address.stellar_address);
    return address;
  } catch (error) {
    console.error("Failed to get address:", error);
    throw error;
  }
};
```

**Caching**: Results are cached in localStorage with user-specific keys

##### `getAccountBalance()`

**Description**: Retrieves account balance from Stellar network.

**Returns**: `Promise<string>`

**Usage**:
```javascript
const { getAccountBalance } = useAuth();

const checkBalance = async () => {
  try {
    const balance = await getAccountBalance();
    console.log("Balance:", balance);
    return balance;
  } catch (error) {
    console.error("Balance check failed:", error);
    throw error;
  }
};
```

**Return Values**:
- `"X.XXXXXXX XLM"` - Account balance
- `"Account not found (unfunded)"` - Unfunded account
- Throws error on network failures

##### `buildAndSubmitTransaction(destination, amount)`

**Description**: Sends XLM to specified address.

**Parameters**:
- `destination` (string): Target Stellar address
- `amount` (string): Amount in XLM (e.g., "10.5")

**Returns**: `Promise<TransactionResult>`

```typescript
interface TransactionResult {
  success: boolean;
  message: string;
  transactionHash?: string;
  transactionLink?: string;
  details?: any;
}
```

**Usage**:
```javascript
const { buildAndSubmitTransaction } = useAuth();

const sendPayment = async () => {
  try {
    const result = await buildAndSubmitTransaction(
      "GDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "10.5"
    );
    
    if (result.success) {
      console.log("Transaction successful:", result.transactionHash);
      window.open(result.transactionLink, '_blank');
    } else {
      console.error("Transaction failed:", result.message);
    }
  } catch (error) {
    console.error("Error:", error);
  }
};
```

---

## Integration Examples

### Basic Wallet Integration

```javascript
import React, { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

function MyWallet() {
  const {
    isAuthenticated,
    login,
    logout,
    stellarAddress,
    getAccountBalance,
    buildAndSubmitTransaction
  } = useAuth();
  
  const [balance, setBalance] = useState(null);
  const [sending, setSending] = useState(false);
  
  // Load balance when authenticated
  useEffect(() => {
    if (isAuthenticated && stellarAddress) {
      loadBalance();
    }
  }, [isAuthenticated, stellarAddress]);
  
  const loadBalance = async () => {
    try {
      const bal = await getAccountBalance();
      setBalance(bal);
    } catch (error) {
      console.error('Failed to load balance:', error);
    }
  };
  
  const handleSend = async (destination, amount) => {
    setSending(true);
    try {
      const result = await buildAndSubmitTransaction(destination, amount);
      if (result.success) {
        alert('Transaction successful!');
        loadBalance(); // Refresh balance
      } else {
        alert(`Transaction failed: ${result.message}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setSending(false);
    }
  };
  
  if (!isAuthenticated) {
    return (
      <div>
        <h1>Kosh Wallet</h1>
        <button onClick={login}>Connect Wallet</button>
      </div>
    );
  }
  
  return (
    <div>
      <h1>My Wallet</h1>
      <div>
        <h3>Address:</h3>
        <p>{stellarAddress?.stellar_address}</p>
      </div>
      <div>
        <h3>Balance:</h3>
        <p>{balance || 'Loading...'}</p>
        <button onClick={loadBalance}>Refresh</button>
      </div>
      <div>
        <h3>Send Payment:</h3>
        <SendForm onSend={handleSend} loading={sending} />
      </div>
      <button onClick={logout}>Disconnect</button>
    </div>
  );
}
```

### Advanced Transaction Handling

```javascript
class TransactionManager {
  constructor(authHook) {
    this.auth = authHook;
    this.pendingTransactions = new Map();
  }
  
  async sendWithRetry(destination, amount, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Transaction attempt ${attempt}/${maxRetries}`);
        
        const result = await this.auth.buildAndSubmitTransaction(
          destination, 
          amount
        );
        
        if (result.success) {
          this.trackTransaction(result.transactionHash, {
            destination,
            amount,
            timestamp: Date.now(),
            status: 'submitted'
          });
          return result;
        } else {
          throw new Error(result.message);
        }
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }
    
    throw new Error(`Transaction failed after ${maxRetries} attempts: ${lastError.message}`);
  }
  
  trackTransaction(hash, details) {
    this.pendingTransactions.set(hash, details);
    
    // Monitor transaction status
    this.monitorTransaction(hash);
  }
  
  async monitorTransaction(hash) {
    // Poll Stellar network for transaction confirmation
    const maxPolls = 30; // 5 minutes with 10s intervals
    
    for (let i = 0; i < maxPolls; i++) {
      try {
        const response = await fetch(
          `https://horizon-testnet.stellar.org/transactions/${hash}`
        );
        
        if (response.ok) {
          const tx = await response.json();
          this.updateTransactionStatus(hash, 'confirmed', tx);
          return;
        }
      } catch (error) {
        console.warn('Error checking transaction status:', error);
      }
      
      await this.delay(10000); // Wait 10 seconds
    }
    
    this.updateTransactionStatus(hash, 'timeout');
  }
  
  updateTransactionStatus(hash, status, data = null) {
    const tx = this.pendingTransactions.get(hash);
    if (tx) {
      tx.status = status;
      tx.confirmedAt = Date.now();
      tx.data = data;
      
      // Notify listeners
      this.notifyStatusChange(hash, tx);
    }
  }
  
  notifyStatusChange(hash, transaction) {
    window.dispatchEvent(new CustomEvent('transactionStatusChange', {
      detail: { hash, transaction }
    }));
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
const { auth } = useAuth();
const txManager = new TransactionManager(auth);

// Send with automatic retry
const result = await txManager.sendWithRetry(
  "GDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "10.0"
);

// Listen for status updates
window.addEventListener('transactionStatusChange', (event) => {
  const { hash, transaction } = event.detail;
  console.log(`Transaction ${hash} status: ${transaction.status}`);
});
```

---

## Error Handling

### Common Error Codes

#### Backend Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `"Invalid public key length; expected 32 bytes"` | IC cryptography error | Retry call, check IC network status |
| `"Generated Stellar address does not start with 'G'"` | Address generation error | Verify derivation path, retry |
| `"Failed to decode XDR"` | Invalid transaction format | Check transaction parameters |
| `"HTTP request failed: code = Some(404)"` | Account not found on Stellar | Fund account with minimum 1 XLM |
| `"Transaction submission response: {\"type\":\"about:blank\",\"title\":\"Bad Request\",\"status\":400}"` | Malformed transaction | Validate all transaction fields |

#### Frontend Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `"Not authenticated"` | No active Internet Identity session | Call `login()` first |
| `"No actor available"` | Canister connection failed | Check network, redeploy canisters |
| `"Invalid Stellar address format"` | Malformed destination address | Validate address with regex `^G[A-Z2-7]{55}$` |
| `"Failed to parse cached address"` | Corrupted localStorage | Clear cache, regenerate address |

### Error Handling Best Practices

```javascript
const handleError = (error, context) => {
  console.error(`Error in ${context}:`, error);
  
  // Specific error handling
  if (error.message.includes('Not authenticated')) {
    // Redirect to login
    window.location.href = '/login';
    return;
  }
  
  if (error.message.includes('HTTP request failed')) {
    // Network error - show retry option
    showNotification('Network error. Please try again.', 'error');
    return;
  }
  
  if (error.message.includes('Invalid address')) {
    // User input error
    showNotification('Please check the destination address.', 'warning');
    return;
  }
  
  // Generic error handling
  showNotification('An unexpected error occurred. Please try again.', 'error');
};

// Usage in async functions
try {
  const result = await actor.build_stellar_transaction(dest, amount);
  // Handle success
} catch (error) {
  handleError(error, 'send_transaction');
}
```

---

## Rate Limiting and Quotas

### Backend Limitations

- **Signature Generation**: Limited by IC subnet capacity (~100/second globally)
- **HTTP Outcalls**: ~1000 calls per second per canister
- **Cycles**: Each operation consumes cycles (signing: ~26B, HTTP: ~50B)

### Frontend Best Practices

```javascript
// Debounce balance checks
const debouncedBalanceCheck = useMemo(
  () => debounce(getAccountBalance, 1000),
  [getAccountBalance]
);

// Rate limit transaction attempts
const rateLimiter = {
  lastCall: 0,
  minInterval: 5000, // 5 seconds between transactions
  
  canCall() {
    const now = Date.now();
    if (now - this.lastCall < this.minInterval) {
      throw new Error('Please wait before sending another transaction');
    }
    this.lastCall = now;
    return true;
  }
};

const sendTransaction = async (dest, amount) => {
  rateLimiter.canCall();
  return await buildAndSubmitTransaction(dest, amount);
};
```

---

This API reference provides comprehensive documentation for all Kosh wallet interfaces. For implementation details, see the [Technical Documentation](TECHNICAL_DOCUMENTATION.md). 