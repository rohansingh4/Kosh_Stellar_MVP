import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { fetchXLMPrice, formatUsdValue, formatPercentChange } from './priceApi';
import AIStakingCard from './components/AIStakingCard.jsx';

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
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Transaction State
  const [paymentForm, setPaymentForm] = useState({
    destination: '',
    amount: ''
  });
  const [transactionResult, setTransactionResult] = useState(null);
  const [transactionLoading, setTransactionLoading] = useState(false);

  const [tooltip, setTooltip] = useState({ show: false, message: '', x: 0, y: 0 });

  // Auto-fetch balance when address becomes available
  useEffect(() => {
    if (stellarAddress && balanceVisible) {
      handleCheckBalance();
    }
  }, [stellarAddress]);



  useEffect(() => {
    fetchPriceData();
  }, []);

  const fetchPriceData = async () => {
    try {
      setPriceLoading(true);
      const data = await fetchXLMPrice();
      setPriceData(data);
    } catch (error) {
      console.error('Error fetching price data:', error);
    } finally {
      setPriceLoading(false);
    }
  };

  const formatBalance = (balance) => {
    if (!balance) return '0.00';
    const numBalance = parseFloat(balance.replace(' XLM', '') || 0);
    return numBalance.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const handleCheckBalance = async () => {
    if (!stellarAddress) {
      alert('No Stellar address available');
      return;
    }

    setBalanceLoading(true);
    try {
      const balanceResult = await getAccountBalance(stellarAddress.stellar_address);
      setBalance(balanceResult);
    } catch (error) {
      console.error('Error checking balance:', error);
      setBalance('Error checking balance');
    } finally {
      setBalanceLoading(false);
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
      e.target.value = selectedNetwork;
      return;
    }
    
    setSelectedNetwork(newNetwork);
  };

  const handleSendTransaction = async () => {
    if (!paymentForm.destination || !paymentForm.amount) {
      alert('Please fill in all fields');
      return;
    }

    setTransactionLoading(true);
    try {
      const result = await buildAndSubmitTransaction(paymentForm.destination, paymentForm.amount);
      
      if (result.success) {
        setTransactionResult({
          success: true,
          message: result.message,
          transactionHash: result.transactionHash,
          transactionLink: `https://stellar.expert/explorer/testnet/tx/${result.transactionHash}`,
          timestamp: new Date().toLocaleString()
        });
        setPaymentForm({ destination: '', amount: '' });
        setShowSendModal(false);
        
        // Refresh balance after successful transaction
        if (balanceVisible) {
          setTimeout(handleCheckBalance, 2000);
        }
      } else {
        setTransactionResult({
          success: false,
          message: result.message,
          timestamp: new Date().toLocaleString()
        });
      }
    } catch (error) {
      console.error('Transaction error:', error);
      setTransactionResult({
        success: false,
        message: `Transaction failed: ${error.message}`,
        timestamp: new Date().toLocaleString()
      });
    } finally {
      setTransactionLoading(false);
    }
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
    <>
      {/* Background decorative elements */}
      <div className="bg-decorations">
        <div className="bg-glow"></div>
        <div className="floating-orb primary"></div>
        <div className="floating-orb secondary"></div>
        <div className="floating-element purple-element" style={{ animationDelay: '0s' }}></div>
        <div className="floating-element blue-element" style={{ animationDelay: '3s' }}></div>
        <div className="floating-element teal-element" style={{ animationDelay: '1s' }}></div>
        <div className="floating-element green-element" style={{ animationDelay: '4s' }}></div>
        <div className="geometric-element square-element"></div>
        <div className="geometric-element circle-element"></div>
        <div className="geometric-element ring-element"></div>
      </div>

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

          <div className="wallet-title">
            <h1>KOSH Wallet</h1>
            <div className="wallet-logo">🌍</div>
          </div>

          <div className="header-controls">
            <button className="header-btn" onClick={() => setShowSettingsModal(true)}>
              ⚙️
            </button>
            <button className="header-btn menu-btn">
              ☰
            </button>
          </div>
        </header>

        {/* Address Section */}
        <section className="address-section">
          <div className="address-card">
            <h3 className="address-title">Your Stellar Address:</h3>
            <div className="address-display">
              {walletLoading ? (
                <div className="loading">
                  <div className="spinner"></div>
                  Generating your address...
                </div>
              ) : stellarAddress ? (
                <>
                  <div className="address-text">{stellarAddress.stellar_address}</div>
                  <button 
                    className="copy-btn"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(stellarAddress.stellar_address);
                        console.log('Address copied to clipboard');
                      } catch (err) {
                        console.error('Failed to copy address:', err);
                      }
                    }}
                    title="Copy address"
                  >
                    📋
                  </button>
                </>
              ) : (
                <div className="address-error">
                  Address not available. Please refresh.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Balance Section */}
        <section className="balance-section">
          <div className="balance-card">
            <div className="balance-container">
              {balanceVisible ? (
                <h2 className="balance-amount">
                  {balanceLoading ? (
                    <span className="loading"><div className="spinner"></div></span>
                  ) : (
                    <>
                      {formatBalance(balance)}
                      <span className="xlm-label">XLM</span>
                    </>
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
            </div>
            
            {balanceVisible && balance && balance !== 'Error checking balance' && (
              <div className="balance-usd">
                ≈ $1,200.00 USD
                <div className="balance-change positive">+2.34% (24h)</div>
                <div style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', marginTop: '8px', opacity: 0.7 }}>
                  Data from Mock Data
                </div>
              </div>
            )}

            <div className="balance-particles">
              <div className="particle"></div>
              <div className="particle"></div>
              <div className="particle"></div>
              <div className="particle"></div>
              <div className="particle"></div>
            </div>
          </div>
        </section>

        {/* AI Auto-Staking Section */}
        <section className="mb-6">
          <AIStakingCard />
        </section>

        {/* Action Buttons */}
        <section className="action-buttons">
          <div className="action-grid">
            <div className="action-card" onClick={() => setShowSendModal(true)}>
              <div className="action-hover-glow"></div>
              <div className="action-content">
                <div className="action-icon-wrapper send-gradient">
                  <svg className="action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m3 3 3 9-3 9 19-9Z"/>
                    <path d="m6 12 13 0"/>
                  </svg>
                </div>
                <span className="action-label">Send</span>
              </div>
              <div className="action-border-glow"></div>
            </div>

            <div className="action-card" onClick={() => setShowReceiveModal(true)}>
              <div className="action-hover-glow"></div>
              <div className="action-content">
                <div className="action-icon-wrapper receive-gradient">
                  <svg className="action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14"/>
                    <path d="m19 12-7 7-7-7"/>
                  </svg>
                </div>
                <span className="action-label">Receive</span>
              </div>
              <div className="action-border-glow"></div>
            </div>

            <div 
              className="action-card" 
              onClick={() => {
                setTooltip({ 
                  show: true, 
                  message: 'Swap functionality coming soon!', 
                  x: 0, 
                  y: 0 
                });
                setTimeout(() => setTooltip({ show: false, message: '', x: 0, y: 0 }), 2000);
              }}
            >
              <div className="action-hover-glow"></div>
              <div className="action-content">
                <div className="action-icon-wrapper swap-gradient">
                  <svg className="action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                    <path d="M8 16H3v5"/>
                  </svg>
                </div>
                <span className="action-label">Swap</span>
              </div>
              <div className="action-border-glow"></div>
            </div>

            <div 
              className="action-card"
              onClick={() => {
                setTooltip({ 
                  show: true, 
                  message: 'Bridge functionality coming soon!', 
                  x: 0, 
                  y: 0 
                });
                setTimeout(() => setTooltip({ show: false, message: '', x: 0, y: 0 }), 2000);
              }}
            >
              <div className="action-hover-glow"></div>
              <div className="action-content">
                <div className="action-icon-wrapper bridge-gradient">
                  <svg className="action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3"/>
                    <path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
                    <path d="M3 16h3a2 2 0 0 1 2 2v3"/>
                    <path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
                  </svg>
                </div>
                <span className="action-label">Bridge</span>
              </div>
              <div className="action-border-glow"></div>
            </div>
          </div>
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
          <p className="footer-text">
            <span className="threshold-icon">🔐</span>
            Truly decentralized wallet powered by Threshold cryptography
          </p>
        </footer>
      </div>

      {/* Send Modal */}
      {showSendModal && (
        <div className="modal-overlay" onClick={() => setShowSendModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Send XLM</h3>
              <button onClick={() => setShowSendModal(false)} className="close-btn">×</button>
            </div>
            
            <div className="form-group">
              <label>Destination Address</label>
              <input
                type="text"
                value={paymentForm.destination}
                onChange={(e) => setPaymentForm({...paymentForm, destination: e.target.value})}
                placeholder="GDXXXXX..."
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label>Amount (XLM)</label>
              <input
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                placeholder="0.00"
                className="form-input"
                step="0.01"
                min="0.01"
              />
            </div>
            
            <div className="modal-actions">
              <button onClick={() => setShowSendModal(false)} className="secondary-btn">
                Cancel
              </button>
              <button 
                onClick={handleSendTransaction}
                disabled={transactionLoading}
                className="primary-btn"
              >
                {transactionLoading ? 'Sending...' : 'Send Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && (
        <div className="modal-overlay" onClick={() => setShowReceiveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Receive XLM</h3>
              <button onClick={() => setShowReceiveModal(false)} className="close-btn">×</button>
            </div>
            
            <div className="receive-content">
              <p>Share this address to receive XLM:</p>
              <div className="address-display">
                {stellarAddress?.stellar_address || 'Address not available'}
              </div>
              <button 
                onClick={async () => {
                  if (stellarAddress) {
                    try {
                      await navigator.clipboard.writeText(stellarAddress.stellar_address);
                      alert('Address copied to clipboard!');
                    } catch (err) {
                      console.error('Failed to copy:', err);
                    }
                  }
                }}
                className="primary-btn"
              >
                Copy Address
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Settings</h3>
              <button onClick={() => setShowSettingsModal(false)} className="close-btn">×</button>
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

      {/* Tooltip */}
      {tooltip.show && (
        <div 
          className="global-tooltip"
          style={{ 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
          }}
        >
          {tooltip.message}
        </div>
      )}
    </>
  );
}

export default App;
