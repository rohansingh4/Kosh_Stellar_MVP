import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { fetchXLMPrice, formatUsdValue, formatPercentChange } from './priceApi';

function App() {
  const { 
    isAuthenticated, 
    principal, 
    actor, 
    loading, 
    walletLoading,
    stellarAddress,
    login, 
    logout, 
    getStellarAddress,
    buildAndSubmitTransaction,
    getAccountBalance,
  } = useAuth();

  // UI State
  const [selectedNetwork, setSelectedNetwork] = useState('stellar-testnet');
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  
  // Price State
  const [priceData, setPriceData] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);
  
  // Modal State
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showRpcModal, setShowRpcModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Transaction State
  const [paymentForm, setPaymentForm] = useState({
    destination: '',
    amount: ''
  });
  const [transactionResult, setTransactionResult] = useState(null);
  const [transactionLoading, setTransactionLoading] = useState(false);

  // Auto-fetch balance when address becomes available
  useEffect(() => {
    if (stellarAddress && balanceVisible) {
      handleCheckBalance();
    }
  }, [stellarAddress]);

  useEffect(() => {
    if (stellarAddress && balanceVisible) {
      handleCheckBalance();
    }
  }, [stellarAddress, balanceVisible]);

  // Fetch price data when component mounts and when balance becomes visible
  useEffect(() => {
    if (balanceVisible && !priceData && !priceLoading) {
      fetchPriceData();
    }
  }, [balanceVisible]);

  const fetchPriceData = async () => {
    setPriceLoading(true);
    try {
      const data = await fetchXLMPrice();
      setPriceData(data);
      console.log('Price data fetched from:', data.source);
    } catch (error) {
      console.error('Failed to fetch price data:', error);
    } finally {
      setPriceLoading(false);
    }
  };

  const handleGenerateAddress = async () => {
    if (!actor) {
      console.warn('Cannot generate address: not authenticated');
      return;
    }
    
    try {
      const address = await getStellarAddress();
      console.log('Successfully generated Stellar address:', address);
    } catch (error) {
      console.error('Failed to generate Stellar address:', error);
      // Address section will show error state and retry button
    }
  };

  const handleCheckBalance = async () => {
    if (!stellarAddress) return;

    setBalanceLoading(true);
    try {
      const balanceResult = await getAccountBalance();
      setBalance(balanceResult);
    } catch (error) {
      console.error('Balance check error:', error);
      setBalance('Error checking balance');
    } finally {
      setBalanceLoading(false);
    }
  };

  const handleSendPayment = async () => {
    if (!paymentForm.destination || !paymentForm.amount) {
      alert('Please fill in destination address and amount');
      return;
    }

    if (!stellarAddress) {
      alert('Please generate your Stellar address first');
      return;
    }

    setTransactionLoading(true);
    setTransactionResult(null);

    try {
      const result = await buildAndSubmitTransaction(
        paymentForm.destination,
        paymentForm.amount
      );

      let transactionHash = '';
      let transactionLink = '';
      try {
        const parsedResult = JSON.parse(result.details);
        if (parsedResult.id) {
          transactionHash = parsedResult.id;
          transactionLink = `https://stellar.expert/explorer/testnet/tx/${transactionHash}`;
        }
      } catch (e) {
        // If parsing fails, use the raw details
      }

      setTransactionResult({
        success: result.success,
        message: result.message,
        details: result.details,
        transactionHash,
        transactionLink,
        timestamp: new Date().toLocaleString()
      });

      // Clear form and close modal on success
      if (result.success) {
        setPaymentForm({ destination: '', amount: '' });
        setShowSendModal(false);
        // Refresh balance
        setTimeout(() => {
          if (balanceVisible) handleCheckBalance();
        }, 2000);
      }

    } catch (error) {
      console.error('Payment error:', error);
      setTransactionResult({
        success: false,
        message: 'Transaction failed: ' + error.message,
        timestamp: new Date().toLocaleString()
      });
    } finally {
      setTransactionLoading(false);
    }
  };

  const formatBalance = (balance) => {
    if (!balance || balance === 'Error checking balance') return '****';
    try {
      const numBalance = parseFloat(balance.replace(' XLM', ''));
      return numBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 7 });
    } catch {
      return '****';
    }
  };



  const networkOptions = [
    { value: 'stellar-testnet', label: 'Stellar Testnet', available: true },
    { value: 'stellar-mainnet', label: 'Stellar Mainnet', available: false },
    { value: 'bitcoin', label: 'Bitcoin', available: false },
    { value: 'solana', label: 'Solana', available: false },
    { value: 'ethereum', label: 'Ethereum', available: false }
  ];

  const handleNetworkChange = (e) => {
    const newNetwork = e.target.value;
    const networkOption = networkOptions.find(opt => opt.value === newNetwork);
    
    if (!networkOption.available) {
      alert('Coming Soon! This network is not yet supported.');
      // Reset to current network
      e.target.value = selectedNetwork;
      return;
    }
    
    setSelectedNetwork(newNetwork);
  };

  if (loading) {
    return (
      <div className="wallet-container">
        <div className="loading">
          <div className="spinner"></div>
          Loading wallet...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-screen">
        <div className="auth-content">
          <h1 className="auth-title">KOSH Wallet</h1>
          <p className="auth-subtitle">
            Your keyless crypto wallet powered by Internet Identity and threshold cryptography
          </p>
          
          <div className="auth-options">
            <button 
              className="auth-social-btn google-btn"
              onClick={(e) => e.preventDefault()}
            >
              <div className="google-icon">
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              Continue with Google
              <div className="coming-soon-tooltip">Coming Soon</div>
            </button>
            
            <button 
              className="auth-social-btn apple-btn"
              onClick={(e) => e.preventDefault()}
            >
              <div className="apple-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              </div>
              Continue with Apple
              <div className="coming-soon-tooltip">Coming Soon</div>
            </button>
            
            <div className="auth-divider">
              <span>or</span>
            </div>
            
            <button onClick={login} className="auth-btn internet-identity-btn">
              <span className="auth-icon">🔐</span>
              Connect with Internet Identity
            </button>
          </div>
          
          <div className="auth-footer">
            <img src="/logo2.svg" alt="Internet Computer Logo" className="auth-icp-logo" />
            <p className="auth-powered">Powered by Internet Computer</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-container">
      {/* Header */}
      <header className="wallet-header">
                 <div className="network-dropdown">
           <select 
             value={selectedNetwork} 
             onChange={handleNetworkChange}
             className="network-select"
           >
             {networkOptions.map(option => (
               <option key={option.value} value={option.value}>
                 {option.label}
               </option>
             ))}
           </select>
         </div>
        
        <div className="wallet-logo">
          <h1 className="wallet-title">KOSH Wallet</h1>
        </div>
        
        <div className="header-controls">
          <button 
            className="header-btn"
            onClick={() => setShowRpcModal(true)}
            title="RPC Settings"
          >
            🌍
          </button>
          <button 
            className="header-btn"
            onClick={() => setShowSettingsModal(true)}
            title="Settings"
          >
            ☰
          </button>
        </div>
             </header>

       {/* Stellar Address Section */}
       <section className="address-section">
         <div className="address-container">
           <div className="address-info">
             <span className="address-label">Your Stellar Address:</span>
             <div className="address-value">
               {walletLoading ? (
                 <span className="address-loading">
                   <div className="spinner-small"></div>
                   Generating address...
                 </span>
               ) : stellarAddress ? (
                 `${stellarAddress.stellar_address.substring(0, 8)}...${stellarAddress.stellar_address.substring(stellarAddress.stellar_address.length - 8)}`
               ) : isAuthenticated && actor ? (
                 <span className="address-loading">
                   <div className="spinner-small"></div>
                   Preparing wallet...
                 </span>
               ) : (
                 <span className="address-error">
                   Address not generated
                   <button 
                     className="retry-btn"
                     onClick={handleGenerateAddress}
                     title="Retry generating address"
                   >
                     🔄
                   </button>
                 </span>
               )}
             </div>
           </div>
           {stellarAddress && (
             <button 
               className="copy-btn"
               onClick={() => {
                 navigator.clipboard.writeText(stellarAddress.stellar_address);
                 // Show brief feedback
                 const btn = document.querySelector('.copy-btn');
                 const originalText = btn.textContent;
                 btn.textContent = '✓';
                 setTimeout(() => {
                   btn.textContent = originalText;
                 }, 1000);
               }}
               title="Copy address"
             >
               📋
             </button>
           )}
         </div>
       </section>

       {/* Balance Section */}
      <section className="balance-section">
        <div className="balance-container">
          {balanceVisible ? (
            <h2 className="balance-amount">
              {balanceLoading ? (
                <span className="loading"><div className="spinner"></div></span>
              ) : (
                `${formatBalance(balance)} XLM`
              )}
            </h2>
          ) : (
            <h2 className="balance-hidden">••••••••</h2>
          )}
          <button 
            className="eye-btn"
            onClick={() => setBalanceVisible(!balanceVisible)}
            title={balanceVisible ? "Hide balance" : "Show balance"}
          >
            {balanceVisible ? '👁️' : '👁️‍🗨️'}
          </button>
          {balanceVisible && (
            <button 
              className="eye-btn"
              onClick={fetchPriceData}
              disabled={priceLoading}
              title="Refresh price data"
              style={{ marginLeft: '8px' }}
            >
              {priceLoading ? '⏳' : '🔄'}
            </button>
          )}
        </div>
        
        {balanceVisible && balance && balance !== 'Error checking balance' && (
          <>
            <div className="balance-usd">
              {priceData ? (
                `≈ $${formatUsdValue(parseFloat(balance.replace(' XLM', '') || 0), priceData.price)} USD`
              ) : priceLoading ? (
                'Loading price...'
              ) : (
                'Price unavailable'
              )}
            </div>
            {priceData && (
              <>
                <div className={`balance-change ${priceData.change24h >= 0 ? 'positive' : 'negative'}`}>
                  {formatPercentChange(priceData.change24h)} (24h)
                </div>
                {priceData.source !== 'CoinMarketCap' && (
                  <div style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>
                    Data from {priceData.source}
                  </div>
                )}
              </>
            )}
          </>
        )}
        
        {balanceVisible && balance === 'Error checking balance' && (
          <div className="balance-usd text-error">
            Error loading balance
          </div>
        )}
      </section>

      {/* AI Staking Section */}
      <section className="staking-section">
        <div className="staking-content">
          <h3 className="staking-title">🤖 AI Auto-Staking</h3>
          <p className="staking-subtitle">Automatic staking & yield optimization</p>
          <div className="staking-animation"></div>
          <div className="staking-return">7.2% APY</div>
        </div>
        <div className="coming-soon">Coming Soon</div>
      </section>

             {/* Action Buttons */}
       <section className="action-buttons">
         <button 
           className="action-btn"
           onClick={() => setShowSendModal(true)}
         >
           <span className="action-icon">📤</span>
           <span className="action-label">Send</span>
         </button>
         
         <button 
           className="action-btn"
           onClick={() => setShowReceiveModal(true)}
         >
           <span className="action-icon">📥</span>
           <span className="action-label">Receive</span>
         </button>
         
         <button 
           className="action-btn"
           onClick={() => alert('Swap functionality coming soon!')}
         >
           <span className="action-icon">🔄</span>
           <span className="action-label">Swap</span>
         </button>
         
         <button 
           className="action-btn"
           onClick={() => alert('Bridge functionality coming soon!')}
         >
           <span className="action-icon">🌉</span>
           <span className="action-label">Bridge</span>
         </button>
       </section>

      {/* Transaction Result */}
      {transactionResult && (
        <div className={`transaction-result ${transactionResult.success ? 'success' : 'error'}`}>
          <h4>{transactionResult.success ? '✅ Transaction Successful' : '❌ Transaction Failed'}</h4>
          <p><strong>Time:</strong> {transactionResult.timestamp}</p>
          <p><strong>Message:</strong> {transactionResult.message}</p>
          {transactionResult.transactionHash && (
            <p>
              <strong>Transaction:</strong>{' '}
              <a 
                href={transactionResult.transactionLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="transaction-link"
              >
                {transactionResult.transactionHash.substring(0, 16)}...
              </a>
            </p>
          )}
        </div>
      )}

             {/* Footer */}
       <footer className="wallet-footer">
         <div className="footer-signature">
           Truly decentralized wallet powered by Threshold cryptography
         </div>
       </footer>

      {/* Send Modal */}
      {showSendModal && (
        <div className="modal-overlay" onClick={() => setShowSendModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Send XLM</h3>
              <button className="close-btn" onClick={() => setShowSendModal(false)}>×</button>
            </div>
            
            <div className="form-group">
              <label className="form-label">Destination Address</label>
              <input
                type="text"
                className="form-input"
                value={paymentForm.destination}
                onChange={(e) => setPaymentForm({...paymentForm, destination: e.target.value})}
                placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Amount (XLM)</label>
              <input
                type="number"
                className="form-input"
                step="1"
                min="1"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                placeholder="10"
              />
            </div>
            
            <button 
              className="primary-btn"
              onClick={handleSendPayment}
              disabled={transactionLoading}
            >
              {transactionLoading ? 'Processing...' : 'Send Payment'}
            </button>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && (
        <div className="modal-overlay" onClick={() => setShowReceiveModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Receive XLM</h3>
              <button className="close-btn" onClick={() => setShowReceiveModal(false)}>×</button>
            </div>
            
            {stellarAddress ? (
              <div>
                <p className="form-label">Your Stellar Address:</p>
                <div className="address-display">
                  {stellarAddress.stellar_address}
                </div>
                <div className="text-center mb-20">
                  <p className="text-muted mb-12">Fund your testnet account:</p>
                  <a 
                    href={`https://friendbot.stellar.org/?addr=${stellarAddress.stellar_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="primary-btn"
                    style={{ display: 'inline-block', width: 'auto', padding: '8px 16px', textDecoration: 'none' }}
                  >
                    Get 10,000 XLM from Friendbot
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-muted mb-16">Generating your address...</p>
                <div className="loading">
                  <div className="spinner"></div>
                  Please wait
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RPC Settings Modal */}
      {showRpcModal && (
        <div className="modal-overlay" onClick={() => setShowRpcModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">RPC Settings</h3>
              <button className="close-btn" onClick={() => setShowRpcModal(false)}>×</button>
            </div>
            
            <div className="form-group">
              <label className="form-label">Stellar Horizon URL</label>
              <input
                type="text"
                className="form-input"
                defaultValue="https://horizon-testnet.stellar.org"
                placeholder="https://horizon-testnet.stellar.org"
              />
            </div>
            
            <button className="primary-btn">
              Save RPC Settings
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Settings</h3>
              <button className="close-btn" onClick={() => setShowSettingsModal(false)}>×</button>
            </div>
            
            <div className="form-group">
              <button className="primary-btn mb-12">
                📤 Export Funds
              </button>
              <p className="text-muted" style={{ fontSize: '12px' }}>
                Send all XLM to an external wallet
              </p>
            </div>
            
            <div className="form-group">
              <h4 style={{ marginBottom: '12px', fontSize: '16px' }}>About</h4>
              <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
                <p className="mb-8"><strong>Internet Identity:</strong></p>
                <div className="address-display" style={{ fontSize: '10px' }}>
                  {principal?.toString()}
                </div>
                <button 
                  onClick={logout}
                  className="primary-btn"
                  style={{ background: '#ea4335', marginTop: '12px' }}
                >
                  Disconnect Wallet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
