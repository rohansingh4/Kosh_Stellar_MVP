# KOSH Wallet - Trustline & Token Management Guide

## Overview
KOSH Wallet now includes comprehensive trustline management and token balance tracking functionality. This allows users to manage their Stellar asset trustlines and view all token balances in one place.

## Features

### ✅ Implemented Features

#### 🔗 **Trustline Management**
- **Create Trustlines**: Add support for new Stellar assets
- **Check Trustlines**: Verify existing trustlines before transactions
- **Popular Assets**: Quick setup for USDC, USDT, AQUA, yXLM, SRT
- **Custom Assets**: Add any Stellar asset by code and issuer
- **Trust Limits**: Optional limits on asset holdings
- **Status Verification**: Real-time trustline authorization checks

#### 🪙 **Token Balance Display**
- **All Assets View**: See balances for all trusted assets
- **Active Assets**: Highlight tokens with non-zero balances
- **Trustline Overview**: View all established trustlines
- **Balance Privacy**: Toggle visibility of amounts
- **Real-time Refresh**: Update balances on demand
- **Network Awareness**: Separate balances for mainnet/testnet

#### 🔄 **Swap Integration**
- **Automatic Trustline Checks**: Verify destination asset trustlines before swaps
- **One-click Trustline Creation**: Create missing trustlines during swaps
- **Status Indicators**: Visual feedback for trustline requirements
- **Seamless Integration**: Built into the swap interface

## User Interface

### 📱 **New Action Buttons**
Your KOSH wallet now has additional action buttons:

1. **Send** (📤) - Send XLM to other accounts
2. **Receive** (📥) - Display your address for receiving payments
3. **Swap** (🔄) - Exchange XLM for other tokens
4. **Tokens** (🔁) - View all token balances and trustlines
5. **Bridge** (🌉) - Coming soon

### 🪙 **Token Balances Screen**
- **Active Assets**: Shows tokens with positive balances
- **Trustlines**: Displays all established trustlines (even with 0 balance)
- **Asset Information**: Shows asset codes, issuers, and authorization status
- **Add Trustline Button**: Quick access to trustline creation

### ⚙️ **Trustline Manager**
- **Popular Assets Grid**: One-click setup for common tokens
- **Custom Asset Form**: Manual entry for any Stellar asset
- **Trustline Status**: Real-time verification of existing trustlines
- **Trust Limits**: Optional spending limits for assets

## Backend Functions

### 🔧 **New API Endpoints**

#### `create_trustline`
```rust
async fn create_trustline(
    asset_code: String,
    asset_issuer: String,
    limit: Option<String>,
    network: Option<String>,
) -> Result<String, String>
```
- Creates trustlines for Stellar assets
- Optional trust limits
- Network-aware (mainnet/testnet)

#### `get_account_assets`
```rust
async fn get_account_assets(
    network: Option<String>
) -> Result<String, String>
```
- Retrieves all account balances and trustlines
- Includes native XLM and all trusted assets
- Returns authorization status and limits

#### `check_trustline`
```rust
async fn check_trustline(
    asset_code: String,
    asset_issuer: String,
    network: Option<String>,
) -> Result<String, String>
```
- Verifies if trustline exists for specific asset
- Returns trustline details if found
- Used for pre-transaction validation

## Supported Assets

### 🎯 **Popular Pre-configured Assets**
| Asset | Code | Issuer | Description |
|-------|------|---------|-------------|
| 💵 | USDC | `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` | USD Coin stablecoin |
| 💰 | USDT | `GCQTGZQQ5G4PTM2GL7CDIFKUBIPEC52BROAQIAPW53XBRJVN6ZJVTG6V` | Tether USD stablecoin |
| 🌊 | AQUA | `GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA` | Aquarius AMM token |
| ⭐ | yXLM | `GARDNV3Q7YGT4AKSDF25LT32YSCCW67G2P2OBKQP5PMPOUF2FIKW7SSP` | Yield-bearing XLM |
| 🏢 | SRT | `GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B` | SmartLands token |

## How to Use

### 👀 **View Token Balances**

1. **Open Token View**:
   - Click the "Tokens" button (🔁) in action buttons
   - View all your asset balances and trustlines

2. **Balance Privacy**:
   - Use the eye icon to hide/show balance amounts
   - Toggle between visible amounts and privacy dots

3. **Refresh Balances**:
   - Click the refresh icon to update all balances
   - Automatic network-aware fetching

### ➕ **Add New Trustlines**

1. **Quick Setup (Popular Assets)**:
   - Click "Tokens" → "Add New Trustline"
   - Select from popular assets grid
   - One-click trustline creation

2. **Custom Asset**:
   - Enter asset code (e.g., "USDC")
   - Enter issuer address
   - Optional: Set trust limit
   - Click "Create Trustline"

3. **Verification**:
   - Use "Check Status" to verify existing trustlines
   - See authorization and limit information

### 🔄 **Smart Swapping with Trustlines**

1. **Automatic Checks**:
   - When selecting a destination asset in swap
   - KOSH automatically checks if you have the required trustline

2. **One-click Creation**:
   - If trustline is missing, a "Create Trustline" button appears
   - Click to create trustline before swapping

3. **Status Indicators**:
   - ✅ Green checkmark: Trustline exists and is ready
   - ⚠️ Yellow warning: Trustline required
   - 🔄 Loading spinner: Checking trustline status

## Asset Status Types

### 📊 **Trustline Status Indicators**

| Status | Badge Color | Description |
|---------|------------|-------------|
| **Native** | Blue | XLM (no trustline needed) |
| **Active** | Green | Authorized and ready to use |
| **Unauthorized** | Red | Not authorized by issuer |
| **Limited** | Amber | Limited authorization |

### 🔐 **Authorization Levels**

- **`is_authorized`**: Can receive and send the asset
- **`is_authorized_to_maintain_liabilities`**: Can maintain existing balances
- **Trust Limits**: Maximum amount allowed to hold

## Network Support

### 🌐 **Multi-Network Operation**

**Mainnet Configuration**:
- Horizon API: `https://horizon.stellar.org`
- Network Passphrase: `"Public Global Stellar Network ; September 2015"`
- Real asset issuers and production tokens

**Testnet Configuration**:
- Horizon API: `https://horizon-testnet.stellar.org`  
- Network Passphrase: `"Test SDF Network ; September 2015"`
- Test tokens for development and testing

## Security Features

### 🔒 **Built-in Protections**

1. **Trustline Verification**: Always verify trustlines before transactions
2. **Issuer Validation**: Prevent typos in asset issuer addresses  
3. **Network Isolation**: Separate mainnet and testnet operations
4. **Trust Limits**: Optional spending limits for additional security
5. **Authorization Checks**: Verify asset permissions before use

## Technical Implementation

### 📁 **Component Structure**

```
components/
├── TokenBalances.tsx      # Main token balance display
├── TrustlineManager.tsx   # Trustline creation interface
├── SwapComponent.tsx      # Updated with trustline checks
└── ActionButtons.tsx      # Integration point for all features
```

### 🔧 **Key Functions**

**Frontend (TypeScript/React)**:
- `TokenBalances`: Display all user assets with status
- `TrustlineManager`: Create and manage trustlines
- `SwapComponent`: Enhanced with trustline verification
- Automatic trustline checks during asset selection

**Backend (Rust/IC)**:
- `create_trustline()`: Secure trustline creation
- `get_account_assets()`: Comprehensive asset fetching
- `check_trustline()`: Real-time trustline verification
- Network-aware Horizon API integration

## Error Handling

### ⚠️ **Common Issues & Solutions**

| Error | Cause | Solution |
|-------|-------|----------|
| "Trustline not found" | Asset not trusted | Create trustline first |
| "Invalid asset code" | Typo in asset code | Verify correct asset code |
| "Invalid issuer" | Wrong issuer address | Check issuer on stellar.expert |
| "Unauthorized trustline" | Issuer restrictions | Contact asset issuer |
| "Account not found" | Network mismatch | Switch to correct network |

### 🛠️ **Troubleshooting**

1. **Asset Not Showing**:
   - Verify trustline creation was successful
   - Check you're on the correct network
   - Refresh the token balances view

2. **Cannot Create Trustline**:
   - Ensure sufficient XLM for transaction fee
   - Verify asset code and issuer are correct
   - Check network connectivity

3. **Swap Fails**:
   - Ensure destination asset trustline exists
   - Verify asset is authorized
   - Check trust limit allows the swap amount

## Best Practices

### 💡 **Recommendations**

1. **Verify Assets**: Always verify asset details on stellar.expert before creating trustlines
2. **Start Small**: Test with small amounts on testnet first
3. **Trust Limits**: Consider setting trust limits for unknown assets
4. **Regular Review**: Periodically review and clean up unused trustlines
5. **Network Awareness**: Always check which network you're using

### 🎯 **Optimal Workflow**

1. **Research** → Verify asset on Stellar explorer
2. **Create** → Add trustline for the asset
3. **Verify** → Check trustline status
4. **Trade** → Use swap functionality
5. **Monitor** → Track balances and transactions

## Future Enhancements

### 🚀 **Planned Features**

- **Trustline Removal**: Remove unused trustlines to reclaim reserves
- **Batch Operations**: Create multiple trustlines in one transaction
- **Asset Metadata**: Rich asset information and logos
- **Portfolio View**: USD value tracking across all assets
- **Transaction History**: Detailed asset transaction logs
- **DeFi Integration**: Direct AMM pool interactions

---

## Support

### 📞 **Getting Help**

1. **Token Balance Issues**: Use the refresh button and check network
2. **Trustline Problems**: Verify asset code and issuer on stellar.expert
3. **Swap Failures**: Ensure trustlines exist for destination assets
4. **Network Issues**: Confirm you're on the intended network (mainnet/testnet)

**Your KOSH wallet now provides complete Stellar asset management! 🎉**

Start by clicking the "Tokens" button to see your current assets, or use the swap feature with automatic trustline management for seamless token exchanges.