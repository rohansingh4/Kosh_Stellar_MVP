# Kosh Stellar Wallet Frontend

A standalone React frontend for the Kosh Stellar Wallet that connects directly to the Internet Computer backend canister using Internet Identity for authentication.

## Features

- ✅ Internet Identity authentication
- ✅ Direct communication with IC backend canister (no frontend canister needed)
- ✅ Stellar wallet functionality (send XLM, check balance)
- ✅ Network switching (Testnet/Mainnet)
- ✅ AWS Amplify deployment ready
- ✅ Modern React with TypeScript and Tailwind CSS

## Quick Start

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Update canister IDs if needed
```

3. Start development server:
```bash
npm run dev
```

The app will be available at http://localhost:3000

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` folder.

## AWS Amplify Deployment

This frontend is configured for easy deployment on AWS Amplify:

1. Connect your repository to AWS Amplify
2. The `amplify.yml` file will automatically configure the build process
3. Environment variables can be set in the Amplify Console

### Required Environment Variables for Production:

- `VITE_CANISTER_ID_BACKEND_MAINNET` - Your mainnet backend canister ID
- `VITE_IC_HOST_MAINNET` - IC gateway (https://icp0.io)

## Architecture

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│                     │    │                      │    │                     │
│   React Frontend    │◄──►│  Internet Identity   │◄──►│   Backend Canister  │
│   (AWS Amplify)     │    │                      │    │   (Stellar Wallet)  │
│                     │    │                      │    │                     │
└─────────────────────┘    └──────────────────────┘    └─────────────────────┘
```

- **Frontend**: Deployed on AWS Amplify (or any static hosting)
- **Authentication**: Internet Identity (IC)
- **Backend**: Your existing Kosh backend canister
- **No frontend canister needed**: Direct actor communication

## Backend Integration

The frontend communicates with your backend canister using these methods:

- `public_key_stellar()` - Generate Stellar address
- `build_stellar_transaction()` - Send XLM transactions
- `get_account_balance()` - Check account balance
- `get_account_assets()` - List account assets
- `create_trustline()` - Create token trustlines
- `execute_token_swap()` - Swap tokens

## Network Configuration

The app automatically detects the environment:

- **Local**: Uses localhost:4943 and local canister IDs
- **Production**: Uses IC mainnet and your deployed canister IDs

## Security

- All authentication handled by Internet Identity
- No private keys stored in frontend
- Direct canister communication using IC agent
- Transactions signed by backend canister using threshold cryptography

## Development

### Project Structure

```
src/
├── components/          # React components
├── hooks/              # Custom hooks (useAuth)
├── lib/                # Utilities and actor setup
├── pages/              # Page components
├── types/              # TypeScript definitions
└── App.tsx             # Main app component
```

### Key Files

- `src/hooks/useAuth.ts` - Internet Identity integration
- `src/lib/actor.ts` - IC agent and canister actor setup
- `src/types/backend.ts` - Backend canister interface
- `src/components/` - UI components for wallet functionality

### Customization

To modify for your specific backend:

1. Update `CANISTER_IDS` in `src/lib/actor.ts`
2. Modify backend interface in `src/types/backend.ts`
3. Update network configurations as needed

## Troubleshooting

### Common Issues

1. **Certificate verification errors**: Usually happens when mixing local/mainnet environments
2. **Canister not found**: Check canister IDs in configuration
3. **Network issues**: Verify IC gateway URLs

### Debug Mode

Enable debug logging by opening browser console. The app logs all authentication and canister interactions.

## License

Same as your main Kosh project.