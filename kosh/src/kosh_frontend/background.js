// Kosh Wallet Background Script - Manages wallet state and communication
console.log("Kosh Wallet background script loaded");

// Wallet state management
let walletState = {
    isConnected: false,
    publicKey: null,
    network: 'testnet',
    balance: '0.00',
    isAuthenticated: false,
    principal: null
};

// Price cache
let priceCache = {
    xlmPrice: null,
    lastUpdated: null,
    cacheTimeout: 5 * 60 * 1000 // 5 minutes
};

// Initialize extension
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Kosh Wallet extension installed:', details.reason);
    
    // Set default storage values
    chrome.storage.local.set({
        walletState: walletState,
        settings: {
            network: 'testnet',
            autoConnect: false,
            notifications: true
        }
    });
    
    // Create context menu for easy access
    chrome.contextMenus.create({
        id: 'kosh-wallet-connect',
        title: 'Connect Kosh Wallet',
        contexts: ['page']
    });
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);
    
    switch (request.action) {
        case 'getWalletStatus':
            handleGetWalletStatus(sendResponse);
            return true;
            
        case 'connect':
            handleConnect(request, sendResponse);
            return true;
            
        case 'disconnect':
            handleDisconnect(sendResponse);
            return true;
            
        case 'signTransaction':
            handleSignTransaction(request, sendResponse);
            return true;
            
        case 'getBalance':
            handleGetBalance(request, sendResponse);
            return true;
            
        case 'getXLMPrice':
            handleGetXLMPrice(sendResponse);
            return true;
            
        case 'showNotification':
            showNotification(request.title, request.message);
            break;
            
        case 'popupClosed':
            // Handle popup close if needed
            break;
            
        default:
            console.log('Unknown action:', request.action);
            sendResponse({ success: false, error: 'Unknown action' });
    }
});

// Get wallet status
async function handleGetWalletStatus(sendResponse) {
    try {
        const stored = await chrome.storage.local.get(['walletState']);
        const currentState = stored.walletState || walletState;
        
        sendResponse({
            success: true,
            data: currentState
        });
    } catch (error) {
        console.error('Error getting wallet status:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// Handle wallet connection
async function handleConnect(request, sendResponse) {
    try {
        // In a real implementation, this would integrate with Internet Identity
        // For now, we'll simulate the connection process
        
        // Check if we have cached credentials
        const stored = await chrome.storage.local.get(['walletState', 'cachedCredentials']);
        
        if (stored.cachedCredentials && stored.cachedCredentials.publicKey) {
            // Use cached credentials
            walletState = {
                isConnected: true,
                publicKey: stored.cachedCredentials.publicKey,
                network: stored.cachedCredentials.network || 'testnet',
                balance: stored.cachedCredentials.balance || '0.00',
                isAuthenticated: true,
                principal: stored.cachedCredentials.principal
            };
        } else {
            // Simulate new connection - in real app, this would trigger Internet Identity flow
            const mockPublicKey = 'GCKFBEIYTKP67PVLOHJPEQSVEB6JBW77DFVGWJJCTAHJ53YIAGQZAXID';
            const mockPrincipal = 'rdmx6-jaaaa-aaaaa-aaadq-cai';
            
            walletState = {
                isConnected: true,
                publicKey: mockPublicKey,
                network: 'testnet',
                balance: '100.50',
                isAuthenticated: true,
                principal: mockPrincipal
            };
            
            // Cache credentials
            await chrome.storage.local.set({
                cachedCredentials: {
                    publicKey: mockPublicKey,
                    network: 'testnet',
                    balance: '100.50',
                    principal: mockPrincipal,
                    timestamp: Date.now()
                }
            });
        }
        
        // Update stored state
        await chrome.storage.local.set({ walletState });
        
        // Notify all tabs about connection
        notifyAllTabs('walletStatusChanged', {
            isConnected: true,
            publicKey: walletState.publicKey,
            network: walletState.network
        });
        
        sendResponse({
            success: true,
            publicKey: walletState.publicKey,
            network: walletState.network
        });
        
        // Show success notification
        showNotification('Kosh Wallet Connected', 'Your wallet is now connected and ready to use');
        
    } catch (error) {
        console.error('Error connecting wallet:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// Handle wallet disconnection
async function handleDisconnect(sendResponse) {
    try {
        walletState = {
            isConnected: false,
            publicKey: null,
            network: 'testnet',
            balance: '0.00',
            isAuthenticated: false,
            principal: null
        };
        
        // Clear cached credentials
        await chrome.storage.local.remove(['cachedCredentials']);
        await chrome.storage.local.set({ walletState });
        
        // Notify all tabs about disconnection
        notifyAllTabs('walletStatusChanged', {
            isConnected: false
        });
        
        sendResponse({ success: true });
        
        showNotification('Kosh Wallet Disconnected', 'Your wallet has been disconnected');
        
    } catch (error) {
        console.error('Error disconnecting wallet:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// Handle transaction signing
async function handleSignTransaction(request, sendResponse) {
    try {
        if (!walletState.isConnected) {
            throw new Error('Wallet not connected');
        }
        
        // In a real implementation, this would:
        // 1. Parse the transaction
        // 2. Show a confirmation popup
        // 3. Sign with the user's private key
        // 4. Return the signed transaction
        
        // For now, simulate signing
        const signedTransaction = {
            ...request.transaction,
            signatures: ['mock_signature_' + Date.now()],
            signed: true,
            signedBy: walletState.publicKey
        };
        
        sendResponse({
            success: true,
            signedTransaction: signedTransaction
        });
        
        showNotification('Transaction Signed', 'Transaction has been signed successfully');
        
    } catch (error) {
        console.error('Error signing transaction:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// Handle balance request
async function handleGetBalance(request, sendResponse) {
    try {
        if (!walletState.isConnected) {
            throw new Error('Wallet not connected');
        }
        
        // In a real implementation, this would query the Stellar network
        // For now, return cached balance or fetch from mock API
        
        let balance = walletState.balance;
        
        // Simulate balance fetching with some randomness
        if (Math.random() > 0.5) {
            const baseBalance = parseFloat(walletState.balance) || 100;
            balance = (baseBalance + (Math.random() - 0.5) * 10).toFixed(2);
            walletState.balance = balance;
            
            // Update stored state
            await chrome.storage.local.set({ walletState });
        }
        
        sendResponse({
            success: true,
            balance: balance
        });
        
    } catch (error) {
        console.error('Error getting balance:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// Handle XLM price request
async function handleGetXLMPrice(sendResponse) {
    try {
        // Check cache first
        const now = Date.now();
        if (priceCache.xlmPrice && priceCache.lastUpdated && 
            (now - priceCache.lastUpdated) < priceCache.cacheTimeout) {
            sendResponse({
                success: true,
                price: priceCache.xlmPrice,
                cached: true
            });
            return;
        }
        
        // Fetch fresh price (simulate API call)
        const mockPrice = 0.12 + (Math.random() - 0.5) * 0.02; // Random price around $0.12
        
        priceCache = {
            xlmPrice: mockPrice,
            lastUpdated: now,
            cacheTimeout: priceCache.cacheTimeout
        };
        
        sendResponse({
            success: true,
            price: mockPrice,
            cached: false
        });
        
    } catch (error) {
        console.error('Error getting XLM price:', error);
        sendResponse({
            success: false,
            error: error.message,
            price: 0.12 // Fallback price
        });
    }
}

// Show notification
function showNotification(title, message) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: title,
        message: message
    });
}

// Notify all tabs about wallet events
async function notifyAllTabs(type, data) {
    try {
        const tabs = await chrome.tabs.query({});
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                type: type,
                ...data
            }).catch(() => {
                // Ignore errors for tabs that don't have content script
            });
        });
    } catch (error) {
        console.error('Error notifying tabs:', error);
    }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'kosh-wallet-connect') {
        // Open popup or trigger connection
        chrome.action.openPopup();
    }
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        // Inject wallet status into newly loaded pages
        if (walletState.isConnected) {
            chrome.tabs.sendMessage(tabId, {
                type: 'walletStatusChanged',
                isConnected: true,
                publicKey: walletState.publicKey,
                network: walletState.network
            }).catch(() => {
                // Ignore errors for restricted pages
            });
        }
    }
});

// Periodic tasks
setInterval(async () => {
    // Refresh balance periodically if connected
    if (walletState.isConnected) {
        try {
            // In a real implementation, query Stellar network for balance
            // For now, just update the cache timestamp
            const stored = await chrome.storage.local.get(['walletState']);
            if (stored.walletState) {
                await chrome.storage.local.set({ walletState: stored.walletState });
            }
        } catch (error) {
            console.error('Error in periodic update:', error);
        }
    }
}, 30000); // Every 30 seconds

// Keep service worker alive
let keepAlive = () => setInterval(chrome.runtime.getPlatformInfo, 20000);
chrome.runtime.onStartup.addListener(keepAlive);
keepAlive();