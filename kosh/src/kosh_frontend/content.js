// Kosh Wallet Content Script - Injects Stellar wallet provider into web pages
console.log("Kosh Wallet content script loaded");

// Inject the Kosh wallet provider into the page
const injectKoshWallet = () => {
  const script = document.createElement('script');
  script.textContent = `
    // Kosh Stellar Wallet Provider
    (function() {
      if (window.koshWallet) return; // Prevent double injection
      
      window.koshWallet = {
        isKosh: true,
        isConnected: false,
        publicKey: null,
        network: 'testnet', // or 'mainnet'
        
        // Connect to Kosh wallet
        connect: async () => {
          return new Promise((resolve, reject) => {
            const requestId = Date.now().toString();
            
            window.postMessage({
              type: 'KOSH_CONNECT_REQUEST',
              requestId,
              source: 'kosh-injected'
            }, '*');
            
            const handleResponse = (event) => {
              if (event.data.type === 'KOSH_CONNECT_RESPONSE' && event.data.requestId === requestId) {
                window.removeEventListener('message', handleResponse);
                if (event.data.success) {
                  window.koshWallet.isConnected = true;
                  window.koshWallet.publicKey = event.data.publicKey;
                  resolve({
                    publicKey: event.data.publicKey,
                    network: event.data.network || 'testnet'
                  });
                } else {
                  reject(new Error(event.data.error || 'Connection failed'));
                }
              }
            };
            
            window.addEventListener('message', handleResponse);
            
            // Timeout after 30 seconds
            setTimeout(() => {
              window.removeEventListener('message', handleResponse);
              reject(new Error('Connection timeout'));
            }, 30000);
          });
        },
        
        // Sign a Stellar transaction
        signTransaction: async (transaction) => {
          if (!window.koshWallet.isConnected) {
            throw new Error('Wallet not connected');
          }
          
          return new Promise((resolve, reject) => {
            const requestId = Date.now().toString();
            
            window.postMessage({
              type: 'KOSH_SIGN_REQUEST',
              requestId,
              transaction: transaction,
              source: 'kosh-injected'
            }, '*');
            
            const handleResponse = (event) => {
              if (event.data.type === 'KOSH_SIGN_RESPONSE' && event.data.requestId === requestId) {
                window.removeEventListener('message', handleResponse);
                if (event.data.success) {
                  resolve(event.data.signedTransaction);
                } else {
                  reject(new Error(event.data.error || 'Transaction signing failed'));
                }
              }
            };
            
            window.addEventListener('message', handleResponse);
            
            setTimeout(() => {
              window.removeEventListener('message', handleResponse);
              reject(new Error('Signing timeout'));
            }, 60000);
          });
        },
        
        // Get account balance
        getBalance: async () => {
          if (!window.koshWallet.isConnected) {
            throw new Error('Wallet not connected');
          }
          
          return new Promise((resolve, reject) => {
            const requestId = Date.now().toString();
            
            window.postMessage({
              type: 'KOSH_BALANCE_REQUEST',
              requestId,
              source: 'kosh-injected'
            }, '*');
            
            const handleResponse = (event) => {
              if (event.data.type === 'KOSH_BALANCE_RESPONSE' && event.data.requestId === requestId) {
                window.removeEventListener('message', handleResponse);
                if (event.data.success) {
                  resolve(event.data.balance);
                } else {
                  reject(new Error(event.data.error || 'Failed to get balance'));
                }
              }
            };
            
            window.addEventListener('message', handleResponse);
            
            setTimeout(() => {
              window.removeEventListener('message', handleResponse);
              reject(new Error('Balance request timeout'));
            }, 15000);
          });
        },
        
        // Disconnect wallet
        disconnect: async () => {
          window.koshWallet.isConnected = false;
          window.koshWallet.publicKey = null;
          
          window.postMessage({
            type: 'KOSH_DISCONNECT_REQUEST',
            source: 'kosh-injected'
          }, '*');
          
          return Promise.resolve();
        },
        
        // Get network info
        getNetwork: () => {
          return window.koshWallet.network;
        },
        
        // Check if wallet is connected
        isConnected: () => {
          return window.koshWallet.isConnected;
        }
      };
      
      // Dispatch wallet ready event
      window.dispatchEvent(new CustomEvent('koshWalletReady', {
        detail: window.koshWallet
      }));
      
      // Also dispatch for compatibility with other wallet detection
      window.dispatchEvent(new CustomEvent('stellar-wallet-ready', {
        detail: { wallet: 'kosh', provider: window.koshWallet }
      }));
      
      console.log('Kosh Wallet provider injected successfully');
    })();
  `;
  
  (document.head || document.documentElement).appendChild(script);
  script.remove();
};

// Listen for messages from the injected script
window.addEventListener('message', async (event) => {
  if (event.source !== window || !event.data.source === 'kosh-injected') {
    return;
  }
  
  try {
    let response;
    
    switch (event.data.type) {
      case 'KOSH_CONNECT_REQUEST':
        response = await chrome.runtime.sendMessage({
          action: 'connect',
          requestId: event.data.requestId
        });
        
        window.postMessage({
          type: 'KOSH_CONNECT_RESPONSE',
          requestId: event.data.requestId,
          ...response
        }, '*');
        break;
        
      case 'KOSH_SIGN_REQUEST':
        response = await chrome.runtime.sendMessage({
          action: 'signTransaction',
          transaction: event.data.transaction,
          requestId: event.data.requestId
        });
        
        window.postMessage({
          type: 'KOSH_SIGN_RESPONSE',
          requestId: event.data.requestId,
          ...response
        }, '*');
        break;
        
      case 'KOSH_BALANCE_REQUEST':
        response = await chrome.runtime.sendMessage({
          action: 'getBalance',
          requestId: event.data.requestId
        });
        
        window.postMessage({
          type: 'KOSH_BALANCE_RESPONSE',
          requestId: event.data.requestId,
          ...response
        }, '*');
        break;
        
      case 'KOSH_DISCONNECT_REQUEST':
        await chrome.runtime.sendMessage({
          action: 'disconnect'
        });
        break;
    }
  } catch (error) {
    console.error('Kosh Wallet content script error:', error);
    
    // Send error response back to page
    if (event.data.requestId) {
      window.postMessage({
        type: event.data.type.replace('_REQUEST', '_RESPONSE'),
        requestId: event.data.requestId,
        success: false,
        error: error.message
      }, '*');
    }
  }
});

// Inject the wallet provider when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectKoshWallet);
} else {
  injectKoshWallet();
}

// Detect wallet connection requests on the page
document.addEventListener('click', (event) => {
  const target = event.target;
  const text = target.textContent || target.innerText || '';
  
  if (text.toLowerCase().includes('connect wallet') || 
      text.toLowerCase().includes('connect to wallet') ||
      target.className.includes('wallet-connect')) {
    
    // Show notification that Kosh wallet is available
    chrome.runtime.sendMessage({
      action: 'showNotification',
      title: 'Kosh Wallet Available',
      message: 'Click the Kosh extension icon to connect your wallet'
    });
  }
});

// Listen for page navigation to re-inject if needed
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(injectKoshWallet, 1000); // Re-inject after navigation
  }
}).observe(document, { subtree: true, childList: true });