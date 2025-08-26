# KOSH Wallet - Stellar Token Swap Guide

## Overview
KOSH Wallet now includes comprehensive token swapping functionality using Stellar's Path Payment Strict Send operations. This allows users to swap XLM to other Stellar tokens directly within the wallet.

## Features

### ✅ Implemented Features
- **Path Payment Strict Send**: Swap XLM to other tokens on Stellar network
- **Real-time Quotes**: Get live exchange rates before swapping
- **Slippage Protection**: Configurable slippage tolerance (0.1%, 0.5%, 1.0%, custom)
- **Popular Assets**: Pre-configured popular Stellar tokens (USDC, USDT, AQUA, yXLM, SRT)
- **Network Support**: Works on both mainnet and testnet
- **UI Integration**: Seamless integration with existing wallet interface
- **Transaction History**: All swaps are recorded with transaction hashes

### 🎯 Supported Assets
- **USDC** (USD Coin) - `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`
- **USDT** (Tether USD) - `GCQTGZQQ5G4PTM2GL7CDIFKUBIPEC52BROAQIAPW53XBRJVN6ZJVTG6V`
- **AQUA** (Aquarius) - `GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA`
- **yXLM** (yXLM) - `GARDNV3Q7YGT4AKSDF25LT32YSCCW67G2P2OBKQP5PMPOUF2FIKW7SSP`
- **SRT** (SmartLands) - `GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B`

## Technical Implementation

### Backend Functions

#### `get_swap_quote`
```rust
async fn get_swap_quote(
    destination_asset_code: String,
    destination_asset_issuer: String,
    send_amount: String,
    network: Option<String>,
) -> Result<String, String>
```
- Fetches real-time quotes from Stellar Horizon API
- Uses strict-send paths to find optimal conversion rates
- Returns JSON with exchange rate, amounts, and path information

#### `execute_token_swap`
```rust
async fn execute_token_swap(
    destination_address: String,
    destination_asset_code: String,
    destination_asset_issuer: String,
    send_amount: u64,
    dest_min: String,
    network: Option<String>,
) -> Result<String, String>
```
- Executes Path Payment Strict Send operation
- Uses threshold cryptography for secure signing
- Includes slippage protection with minimum receive amount
- Supports both mainnet and testnet

### Frontend Components

#### `StellarTokenSwapper` Class
```javascript
class StellarTokenSwapper {
  constructor(secretKey, network = 'mainnet')
  async swapXLMToToken(destinationAddress, destinationAsset, sendAmount, destMin, path = [])
  async getSwapQuote(destinationAsset, sendAmount)
  async hasTrustline(accountId, asset)
  async createTrustline(asset, limit = undefined)
}
```

#### `SwapComponent` React Component
- User-friendly interface for token swapping
- Real-time quote updates
- Configurable slippage settings
- Asset selection with popular tokens
- Progress tracking and error handling

## How to Use

### 1. Access Swap Feature
- Open KOSH Wallet
- Click the "Swap" button (🔄) in the action buttons
- The swap modal will open

### 2. Configure Swap
- **From**: Enter XLM amount to swap
- **To**: Select destination token from dropdown
- **Slippage**: Choose or customize slippage tolerance (default: 0.5%)

### 3. Get Quote
- Click "Get Quote" to fetch current exchange rate
- Review the quote details:
  - Receive amount
  - Exchange rate
  - Minimum amount after slippage
  - Path information (if multi-hop)

### 4. Execute Swap
- Click "Swap [X] XLM to [TOKEN]"
- Confirm the transaction
- Wait for network confirmation
- Balance will update automatically

## Important Notes

### ⚠️ Prerequisites
1. **Trustlines**: Ensure your account has trustlines for destination assets
2. **Balance**: Have sufficient XLM for the swap + transaction fees
3. **Network**: Make sure you're on the correct network (mainnet/testnet)

### 🔒 Security Features
- **Threshold Cryptography**: Uses IC's secure key management
- **Slippage Protection**: Prevents unfavorable price movements
- **Transaction Verification**: All transactions are cryptographically signed
- **Network Isolation**: Mainnet and testnet operations are separate

### 💡 Best Practices
- Start with small amounts for testing
- Use appropriate slippage tolerance (0.5% recommended)
- Check liquidity before large swaps
- Verify asset codes and issuers
- Keep some XLM for future transaction fees

## Network Configuration

### Mainnet
- **Horizon API**: `https://horizon.stellar.org`
- **Network Passphrase**: `"Public Global Stellar Network ; September 2015"`
- **Explorer**: `https://stellar.expert/explorer/public/`

### Testnet
- **Horizon API**: `https://horizon-testnet.stellar.org`
- **Network Passphrase**: `"Test SDF Network ; September 2015"`
- **Explorer**: `https://stellar.expert/explorer/testnet/`

## Error Handling

### Common Errors
- **"No swap path available"**: No liquidity for this asset pair
- **"Transaction would result in less than minimum"**: Increase slippage tolerance
- **"Destination account does not trust the asset"**: Create trustline first
- **"Insufficient balance"**: Need more XLM for the swap

### Solutions
1. **Check Asset Trustlines**: Verify destination account trusts the asset
2. **Adjust Slippage**: Increase tolerance for volatile markets
3. **Check Liquidity**: Try smaller amounts or different assets
4. **Network Issues**: Verify you're on the correct network

## Files Structure

```
kosh/
├── src/
│   ├── kosh_backend/
│   │   └── src/
│   │       └── lib.rs                 # Backend swap functions
│   └── kosh_frontend/
│       └── src/
│           ├── stellarSwap.js         # Stellar SDK wrapper
│           └── components/
│               ├── SwapComponent.tsx  # Main swap UI
│               └── ActionButtons.tsx  # Integrated swap button
```

## SDK Integration Example

```javascript
import StellarTokenSwapper, { STELLAR_ASSETS, SwapUtils } from './stellarSwap.js';

// Initialize swapper
const swapper = new StellarTokenSwapper(secretKey, 'mainnet');

// Get quote
const quote = await swapper.getSwapQuote(STELLAR_ASSETS.USDC, '100');

// Execute swap
const result = await swapper.swapXLMToUSDC(
  destinationAddress,
  '100',          // 100 XLM
  '85.5'          // Minimum 85.5 USDC (with slippage)
);
```

## Future Enhancements

### Planned Features
- **Reverse Swaps**: Token → XLM swaps
- **Multi-hop Optimization**: Better path finding
- **Price Impact**: Display price impact for large swaps
- **Swap History**: Detailed transaction history
- **Limit Orders**: Set price targets for automatic swaps

### Advanced Features
- **DEX Aggregation**: Compare prices across multiple DEXs
- **Liquidity Pool Info**: Show available liquidity
- **Custom Assets**: Add any Stellar asset by code/issuer
- **Batch Swaps**: Multiple swaps in one transaction

---

## Support

For technical support or questions about the swap functionality:
1. Check the KOSH wallet logs for detailed error information
2. Verify network connectivity and asset trustlines
3. Test with small amounts on testnet first
4. Report issues with transaction hashes when possible

**Happy Swapping! 🚀**