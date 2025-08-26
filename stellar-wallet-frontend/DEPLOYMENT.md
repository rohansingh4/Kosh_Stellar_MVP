# Deployment Guide

This guide covers how to deploy the Kosh Stellar Wallet frontend to AWS Amplify.

## Prerequisites

1. Your Kosh backend canister deployed to IC mainnet
2. Backend canister ID ready
3. AWS account with access to Amplify
4. GitHub repository (recommended)

## Step 1: Update Canister Configuration

1. Update the backend canister ID in `src/lib/actor.ts`:
```typescript
// Update this with your actual mainnet backend canister ID
BACKEND: 'nlfjr-7qaaa-aaaaj-qnsiq-cai',  // Replace with your canister ID
```

2. Verify the configuration looks correct for both local and mainnet.

## Step 2: AWS Amplify Deployment

### Option A: GitHub Integration (Recommended)

1. Push this frontend code to a GitHub repository
2. Go to AWS Amplify Console
3. Click "New app" > "Host web app"
4. Connect to GitHub and select your repository
5. Choose the branch (usually `main`)
6. Build settings will be automatically detected from `amplify.yml`
7. Click "Save and deploy"

### Option B: Direct Upload

1. Build the project locally:
```bash
npm run build
```

2. Go to AWS Amplify Console
3. Click "New app" > "Deploy without Git"
4. Upload the `dist` folder
5. Name your app and deploy

## Step 3: Environment Configuration

In AWS Amplify Console, go to your app > Environment variables and add:

```
VITE_CANISTER_ID_BACKEND_MAINNET=your-backend-canister-id
VITE_IC_HOST_MAINNET=https://icp0.io
```

## Step 4: Custom Domain (Optional)

1. In Amplify Console, go to Domain management
2. Add your custom domain
3. Follow AWS instructions for DNS configuration

## Step 5: Testing

1. Once deployed, test the following:
   - Login with Internet Identity works
   - Stellar address generation works
   - Balance fetching works
   - Transaction sending works
   - Network switching works

## Production Checklist

- [ ] Backend canister deployed to mainnet
- [ ] Backend canister ID updated in frontend
- [ ] Frontend built and deployed successfully
- [ ] Internet Identity login works
- [ ] Stellar operations work on both testnet and mainnet
- [ ] Custom domain configured (if needed)
- [ ] SSL certificate active

## Troubleshooting

### Common Issues

1. **"Canister not found" error**
   - Verify your backend canister ID is correct
   - Ensure the backend canister is deployed to mainnet

2. **Internet Identity login fails**
   - Check that you're using the correct II canister ID
   - Verify HTTPS is working on your domain

3. **Certificate verification errors**
   - This usually happens with local/mainnet environment mixing
   - Ensure you're using mainnet configuration for production

4. **Build fails**
   - Run `npm run build` locally first to catch errors
   - Check TypeScript errors and fix them

### Debug Mode

The frontend logs all operations to the browser console. Check the console for detailed error information.

## Architecture

Your deployed architecture will look like:

```
Internet → AWS Amplify → Internet Identity → IC Backend Canister → Stellar Network
```

- **AWS Amplify**: Hosts the React frontend
- **Internet Identity**: Handles user authentication  
- **IC Backend**: Your Kosh backend canister on IC mainnet
- **Stellar Network**: Where transactions are executed

## Security Notes

- All private key operations happen in the backend canister
- Frontend never handles private keys
- Internet Identity provides secure authentication
- All connections use HTTPS/WSS in production

## Monitoring

Monitor your deployment through:
- AWS Amplify Console (build logs, traffic)
- Browser Network tab (API calls)
- IC Dashboard (canister metrics)
- Stellar explorer (transaction confirmation)

## Updates

To update your frontend:
1. Make changes to the code
2. Push to GitHub (if using Git integration)
3. Amplify will automatically rebuild and deploy
4. Or manually upload new dist folder if using direct upload

That's it! Your frontend should now be successfully deployed and communicating with your IC backend canister.