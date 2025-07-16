import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

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

  const [greeting, setGreeting] = useState('');
  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    destination: '',
    amount: ''
  });
  const [transactionResult, setTransactionResult] = useState(null);
  const [transactionLoading, setTransactionLoading] = useState(false);

  // Auto-generate address when authenticated
  useEffect(() => {
    if (isAuthenticated && actor && !stellarAddress) {
      handleGenerateAddress();
    }
  }, [isAuthenticated, actor]);

  const handleGenerateAddress = async () => {
    try {
      const address = await getStellarAddress();
      console.log('Generated Stellar address:', address);
    } catch (error) {
      alert('Failed to generate Stellar address: ' + error.message);
    }
  };

  const handleCheckBalance = async () => {
    if (!stellarAddress) {
      alert('Please generate Stellar address first');
      return;
    }

    setBalanceLoading(true);
    try {
      const balanceResult = await getAccountBalance();
      setBalance(balanceResult);
    } catch (error) {
      console.error('Balance check error:', error);
      setBalance('Error checking balance: ' + error.message);
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

      // Try to parse the response to extract transaction hash
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

      // Clear form on success
      if (result.success) {
        setPaymentForm({ destination: '', amount: '' });
        // Refresh balance
        setTimeout(() => {
          handleCheckBalance();
        }, 2000);
        alert('Payment sent successfully! Check the transaction details below.');
      }

    } catch (error) {
      console.error('Payment error:', error);
      setTransactionResult({
        success: false,
        message: 'Transaction failed: ' + error.message,
        timestamp: new Date().toLocaleString()
      });
      alert('Payment failed: ' + error.message);
    } finally {
      setTransactionLoading(false);
    }
  };

  function handleSubmit(event) {
    event.preventDefault();
    if (!actor) {
      alert('Please login first');
      return false;
    }
    
    const name = event.target.elements.name.value;
    actor.greet(name).then((greeting) => {
      setGreeting(greeting);
    }).catch((error) => {
      console.error('Error calling backend:', error);
      alert('Error calling backend. Make sure you are authenticated.');
    });
    return false;
  }

  if (loading) {
    return (
      <main style={{ textAlign: 'center', padding: '2rem' }}>
        <div>Loading...</div>
      </main>
    );
  }

  return (
    <main style={{ textAlign: 'center', padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <img src="/logo2.svg" alt="DFINITY logo" style={{ width: '100px' }} />
      <h1 style={{ margin: '1rem 0', color: '#333' }}>Kosh - Keyless Stellar Wallet</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Sign transactions with Internet Identity + Threshold Cryptography
      </p>
      
      {/* Authentication Section */}
      <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
        <h3>Authentication Status</h3>
        {isAuthenticated ? (
          <div>
            <p style={{ color: 'green' }}>✅ Authenticated</p>
            <p><strong>Principal:</strong> <code style={{ fontSize: '0.8em' }}>{principal?.toString()}</code></p>
            <button 
              onClick={logout} 
              style={{ 
                padding: '0.5rem 1rem', 
                backgroundColor: '#ff4444', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Logout
            </button>
          </div>
        ) : (
          <div>
            <p style={{ color: 'red' }}>❌ Not Authenticated</p>
            <button 
              onClick={login}
              style={{ 
                padding: '0.5rem 1rem', 
                backgroundColor: '#4444ff', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Login with Internet Identity
            </button>
          </div>
        )}
      </div>

      {isAuthenticated && (
        <>
          {/* Wallet Section */}
          <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f0f8ff' }}>
            <h3>🌟 Your Stellar Wallet</h3>
            
            {/* Address Generation */}
            <div style={{ marginBottom: '1rem' }}>
              <button 
                onClick={handleGenerateAddress} 
                disabled={walletLoading}
                style={{ 
                  padding: '0.5rem 1rem', 
                  backgroundColor: '#28a745', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginRight: '0.5rem'
                }}
              >
                {walletLoading ? 'Generating...' : 'Generate Stellar Address'}
              </button>
              
              {stellarAddress && (
                <div style={{ marginTop: '1rem', textAlign: 'left', backgroundColor: 'white', padding: '1rem', borderRadius: '4px' }}>
                  <p><strong>Your Stellar Address:</strong></p>
                  <code style={{ backgroundColor: '#f1f1f1', padding: '0.5rem', borderRadius: '4px', display: 'block', wordBreak: 'break-all' }}>
                    {stellarAddress.stellar_address}
                  </code>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.9em' }}>
                    <strong>Fund your account:</strong> <a href={`https://friendbot.stellar.org/?addr=${stellarAddress.stellar_address}`} target="_blank" rel="noopener noreferrer">
                      Testnet Friendbot (Click to fund with 10,000 XLM)
                    </a>
                  </p>
                </div>
              )}
            </div>

            {/* Balance Check */}
            {stellarAddress && (
              <div style={{ marginBottom: '1rem' }}>
                <button 
                  onClick={handleCheckBalance} 
                  disabled={balanceLoading}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    backgroundColor: '#007bff', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {balanceLoading ? 'Checking...' : 'Check Balance'}
                </button>
                
                {balance && (
                  <p style={{ marginTop: '0.5rem' }}><strong>Balance:</strong> {balance}</p>
                )}
              </div>
            )}
          </div>

          {/* Payment Section */}
          {stellarAddress && (
            <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fff8dc' }}>
              <h3>💸 Send Payment</h3>
              <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '1rem' }}>
                Send XLM to any Stellar address. Transaction will be automatically built, signed, and submitted.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Destination Address:</label>
                  <input
                    type="text"
                    value={paymentForm.destination}
                    onChange={(e) => setPaymentForm({...paymentForm, destination: e.target.value})}
                    placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Amount (XLM):</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                    placeholder="10"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                  <small style={{ fontSize: '0.8em', color: '#666' }}>
                    Enter whole XLM amounts (e.g., 10 for 10 XLM)
                  </small>
                </div>
              </div>
              
              <button 
                onClick={handleSendPayment}
                disabled={transactionLoading}
                style={{ 
                  padding: '0.75rem 1.5rem', 
                  backgroundColor: '#dc3545', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                {transactionLoading ? 'Processing Transaction...' : 'Send Payment'}
              </button>
            </div>
          )}

          {/* Transaction Result */}
          {transactionResult && (
            <div style={{ 
              marginBottom: '2rem', 
              padding: '1rem', 
              border: `1px solid ${transactionResult.success ? '#28a745' : '#dc3545'}`, 
              borderRadius: '8px', 
              backgroundColor: transactionResult.success ? '#d4edda' : '#f8d7da' 
            }}>
              <h3>{transactionResult.success ? '✅ Transaction Successful' : '❌ Transaction Failed'}</h3>
              <div style={{ textAlign: 'left', fontSize: '0.9em' }}>
                <p><strong>Time:</strong> {transactionResult.timestamp}</p>
                <p><strong>Message:</strong> {transactionResult.message}</p>
                {transactionResult.transactionHash && (
                  <p><strong>Transaction Hash:</strong> <a href={transactionResult.transactionLink} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'underline' }}>{transactionResult.transactionHash}</a></p>
                )}
                {transactionResult.transactionLink && (
                  <p><strong>View on Stellar Explorer:</strong> <a href={transactionResult.transactionLink} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'underline' }}>Click here</a></p>
                )}
                {transactionResult.details && (
                  <details style={{ marginTop: '1rem' }}>
                    <summary style={{ cursor: 'pointer' }}>View Technical Details</summary>
                    <div style={{ marginTop: '0.5rem', fontFamily: 'monospace', fontSize: '0.8em', backgroundColor: '#f1f1f1', padding: '0.5rem', borderRadius: '4px', maxHeight: '200px', overflow: 'auto' }}>
                      {transactionResult.details}
                    </div>
                  </details>
                )}
              </div>
            </div>
          )}

          {/* Test Section */}
          <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f8f9fa' }}>
            <h3>🧪 Test Backend</h3>
            <form action="#" onSubmit={handleSubmit}>
              <label htmlFor="name">Enter your name: &nbsp;</label>
              <input id="name" alt="Name" type="text" />
              <button type="submit" style={{ marginLeft: '0.5rem' }}>Click Me!</button>
            </form>
            <section id="greeting" style={{ marginTop: '1rem', fontWeight: 'bold' }}>
              {greeting}
            </section>
          </div>
        </>
      )}
    </main>
  );
}

export default App;
