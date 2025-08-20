// Kosh Wallet Popup Script
console.log('Kosh Wallet popup loaded');

// State management
let walletState = {
    isConnected: false,
    publicKey: null,
    balance: '0.00',
    network: 'testnet',
    loading: true
};

// DOM elements
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const disconnectedState = document.getElementById('disconnected-state');
const connectedState = document.getElementById('connected-state');
const errorMessage = document.getElementById('error-message');
const balanceAmount = document.getElementById('balance-amount');
const balanceUsd = document.getElementById('balance-usd');
const addressDisplay = document.getElementById('address-display');
const networkBadge = document.getElementById('network-badge');

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initializeWallet();
    } catch (error) {
        console.error('Failed to initialize wallet:', error);
        showError('Failed to initialize wallet: ' + error.message);
    }
});

// Initialize wallet state
async function initializeWallet() {
    try {
        // Get wallet status from background script
        const response = await chrome.runtime.sendMessage({ action: 'getWalletStatus' });
        
        if (response && response.success) {
            walletState = { ...walletState, ...response.data };
            
            if (walletState.isConnected && walletState.publicKey) {
                await loadWalletData();
                showConnectedState();
            } else {
                showDisconnectedState();
            }
        } else {
            showDisconnectedState();
        }
    } catch (error) {
        console.error('Error initializing wallet:', error);
        showError('Failed to connect to wallet service');
    }
}

// Load wallet data (balance, etc.)
async function loadWalletData() {
    try {
        // Get balance
        const balanceResponse = await chrome.runtime.sendMessage({ 
            action: 'getBalance',
            publicKey: walletState.publicKey 
        });
        
        if (balanceResponse && balanceResponse.success) {
            walletState.balance = balanceResponse.balance || '0.00';
            updateBalanceDisplay();
        }
        
        // Get XLM price for USD conversion
        const priceResponse = await chrome.runtime.sendMessage({ action: 'getXLMPrice' });
        if (priceResponse && priceResponse.success) {
            updateUSDBalance(priceResponse.price);
        }
        
    } catch (error) {
        console.error('Error loading wallet data:', error);
    }
}

// Update balance display
function updateBalanceDisplay() {
    if (balanceAmount) {
        balanceAmount.textContent = `${parseFloat(walletState.balance).toFixed(2)} XLM`;
    }
    
    if (addressDisplay && walletState.publicKey) {
        const shortAddress = `${walletState.publicKey.slice(0, 6)}...${walletState.publicKey.slice(-6)}`;
        addressDisplay.textContent = shortAddress;
        addressDisplay.title = walletState.publicKey;
    }
}

// Update USD balance
function updateUSDBalance(xlmPrice) {
    if (balanceUsd && xlmPrice) {
        const usdValue = parseFloat(walletState.balance) * xlmPrice;
        balanceUsd.textContent = `$${usdValue.toFixed(2)} USD`;
    }
}

// Show different states
function showLoadingState() {
    hideAllStates();
    loadingState.classList.remove('hidden');
}

function showErrorState(message) {
    hideAllStates();
    errorMessage.textContent = message;
    errorState.classList.remove('hidden');
}

function showDisconnectedState() {
    hideAllStates();
    disconnectedState.classList.remove('hidden');
    walletState.loading = false;
}

function showConnectedState() {
    hideAllStates();
    connectedState.classList.remove('hidden');
    updateBalanceDisplay();
    walletState.loading = false;
}

function hideAllStates() {
    loadingState.classList.add('hidden');
    errorState.classList.add('hidden');
    disconnectedState.classList.add('hidden');
    connectedState.classList.add('hidden');
}

function showError(message) {
    showErrorState(message);
}

// Wallet actions
async function connectWallet() {
    try {
        showLoadingState();
        
        const response = await chrome.runtime.sendMessage({ action: 'connect' });
        
        if (response && response.success) {
            walletState.isConnected = true;
            walletState.publicKey = response.publicKey;
            walletState.network = response.network || 'testnet';
            
            await loadWalletData();
            showConnectedState();
            
            // Update network badge
            if (networkBadge) {
                networkBadge.textContent = walletState.network.toUpperCase();
            }
        } else {
            showError(response?.error || 'Failed to connect wallet');
        }
    } catch (error) {
        console.error('Connect wallet error:', error);
        showError('Failed to connect: ' + error.message);
    }
}

async function disconnectWallet() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'disconnect' });
        
        if (response && response.success) {
            walletState.isConnected = false;
            walletState.publicKey = null;
            walletState.balance = '0.00';
            
            showDisconnectedState();
        } else {
            showError('Failed to disconnect wallet');
        }
    } catch (error) {
        console.error('Disconnect wallet error:', error);
        showError('Failed to disconnect: ' + error.message);
    }
}

async function refreshBalance() {
    if (!walletState.isConnected || !walletState.publicKey) {
        return;
    }
    
    try {
        // Show loading indicator on button
        const refreshBtn = event.target;
        const originalText = refreshBtn.textContent;
        refreshBtn.textContent = 'Refreshing...';
        refreshBtn.disabled = true;
        
        await loadWalletData();
        
        // Reset button
        refreshBtn.textContent = originalText;
        refreshBtn.disabled = false;
        
        // Show success feedback
        refreshBtn.textContent = 'Refreshed!';
        setTimeout(() => {
            refreshBtn.textContent = originalText;
        }, 1000);
        
    } catch (error) {
        console.error('Refresh balance error:', error);
        showError('Failed to refresh balance');
    }
}

async function copyAddress() {
    if (!walletState.publicKey) {
        return;
    }
    
    try {
        await navigator.clipboard.writeText(walletState.publicKey);
        
        // Show feedback
        const originalText = addressDisplay.textContent;
        addressDisplay.textContent = 'Copied!';
        addressDisplay.style.background = 'rgba(74, 222, 128, 0.3)';
        
        setTimeout(() => {
            addressDisplay.textContent = originalText;
            addressDisplay.style.background = 'rgba(255, 255, 255, 0.1)';
        }, 1000);
        
    } catch (error) {
        console.error('Copy address error:', error);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = walletState.publicKey;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        addressDisplay.textContent = 'Copied!';
        setTimeout(() => {
            updateBalanceDisplay();
        }, 1000);
    }
}

function openFullWallet() {
    // Open the full wallet interface in a new tab
    chrome.tabs.create({
        url: chrome.runtime.getURL('index.html')
    });
    
    // Close popup
    window.close();
}

function retryConnection() {
    initializeWallet();
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'walletStatusChanged':
            if (message.isConnected) {
                walletState.isConnected = true;
                walletState.publicKey = message.publicKey;
                loadWalletData().then(() => showConnectedState());
            } else {
                walletState.isConnected = false;
                walletState.publicKey = null;
                showDisconnectedState();
            }
            break;
            
        case 'balanceUpdated':
            walletState.balance = message.balance;
            updateBalanceDisplay();
            break;
            
        case 'networkChanged':
            walletState.network = message.network;
            if (networkBadge) {
                networkBadge.textContent = message.network.toUpperCase();
            }
            break;
    }
});

// Handle popup close
window.addEventListener('beforeunload', () => {
    // Save any necessary state before closing
    chrome.runtime.sendMessage({ 
        action: 'popupClosed',
        state: walletState 
    });
});

// Global functions for HTML onclick handlers
window.connectWallet = connectWallet;
window.disconnectWallet = disconnectWallet;
window.refreshBalance = refreshBalance;
window.copyAddress = copyAddress;
window.openFullWallet = openFullWallet;
window.retryConnection = retryConnection;
